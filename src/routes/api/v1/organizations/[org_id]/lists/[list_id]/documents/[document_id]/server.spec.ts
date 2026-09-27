import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factories, which vitest lifts above this file's consts,
// can still reach them.
const { mockClient, canOrg, presignDocumentDownload } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn(),
	presignDocumentDownload: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));
vi.mock('$lib/server/storage', () => ({ presignDocumentDownload }));

import { GET, DELETE } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LIST = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';
const DOC = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';

const params = { org_id: ORG, list_id: LIST, document_id: DOC };
const staff = { user: { id: 'u1' } };

function stubDocument(document: Record<string, unknown> | null, listName = 'Main St Block') {
	mockClient.query.mockImplementation((sql: string) => {
		if (sql.includes('FROM universe.list WHERE')) {
			return Promise.resolve({ rowCount: 1, rows: [{ name: listName }] });
		}
		if (sql.includes('FROM universe.list_document')) {
			return Promise.resolve({ rowCount: document ? 1 : 0, rows: document ? [document] : [] });
		}
		return Promise.resolve({ rows: [], rowCount: 0 });
	});
}

const pending = {
	id: DOC,
	list_id: LIST,
	storage_key: `orgs/${ORG}/lists/${LIST}/documents/${DOC}.pdf`,
	status: 'pending',
	error: null,
	created_at: '2026-09-24T00:00:00Z',
	completed_at: null
};

function get(p = params) {
	return GET({ params: p, locals: staff } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	presignDocumentDownload.mockResolvedValue('https://signed.example/get');
	stubDocument(pending);
});

describe('GET list document', () => {
	it('returns status with no download link while pending', async () => {
		const body = await (await get()).json();

		expect(body).toMatchObject({ id: DOC, status: 'pending', download_url: null });
		expect(presignDocumentDownload).not.toHaveBeenCalled();
	});

	it('includes a download link named after the list once ready', async () => {
		stubDocument({ ...pending, status: 'ready' }, 'Main St / Block #2');

		const body = await (await get()).json();

		expect(body.download_url).toBe('https://signed.example/get');
		expect(presignDocumentDownload).toHaveBeenCalledWith(
			pending.storage_key,
			'Main St  Block 2.pdf'
		);
	});

	it('returns the failure reason and no download link when generation failed', async () => {
		stubDocument({ ...pending, status: 'failed', error: 'Object storage is not configured.' });

		const body = await (await get()).json();

		expect(body).toMatchObject({
			status: 'failed',
			error: 'Object storage is not configured.',
			download_url: null
		});
		expect(presignDocumentDownload).not.toHaveBeenCalled();
	});

	it('does not expose the storage key', async () => {
		const body = await (await get()).json();

		expect(body).not.toHaveProperty('storage_key');
	});

	it('scopes the lookup to the list and org', async () => {
		await get();

		const select = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('FROM universe.list_document')
		)!;
		expect(select[1]).toEqual([DOC, LIST, ORG]);
	});

	it('ignores soft-deleted documents', async () => {
		await get();

		const select = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('FROM universe.list_document')
		)!;
		expect(select[0]).toContain('deleted_at IS NULL');
	});

	it('returns 404 when the document is not on this list', async () => {
		stubDocument(null);

		await expect(get()).rejects.toMatchObject({ status: 404 });
	});

	it('returns 400 for a malformed document id', async () => {
		await expect(get({ ...params, document_id: 'nope' })).rejects.toMatchObject({ status: 400 });
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(get()).rejects.toMatchObject({ status: 403 });
	});
});

describe('DELETE list document', () => {
	function del(p = params, locals: object = staff) {
		return DELETE({ params: p, locals } as never);
	}

	/** The UPDATE the handler ran, if any: [sql, params]. */
	function softDelete() {
		return mockClient.query.mock.calls.find((c) => String(c[0]).includes('SET deleted_at'));
	}

	beforeEach(() => {
		mockClient.query.mockImplementation((sql: string) => {
			if (sql.includes('FROM universe.list WHERE')) {
				return Promise.resolve({ rowCount: 1, rows: [{ name: 'Main St' }] });
			}
			if (sql.includes('SET deleted_at')) return Promise.resolve({ rowCount: 1, rows: [] });
			return Promise.resolve({ rows: [], rowCount: 0 });
		});
	});

	it('soft-deletes the document and returns 204', async () => {
		const res = await del();

		expect(res.status).toBe(204);
		const [sql, values] = softDelete()!;
		expect(sql).toContain('SET deleted_at = now()');
		expect(sql).not.toContain('DELETE FROM');
		expect(sql).toContain('id = $1 AND list_id = $2 AND org_id = $3 AND deleted_at IS NULL');
		expect(values).toEqual([DOC, LIST, ORG]);
	});

	it('returns 404 when the document is not on this list or is already deleted', async () => {
		mockClient.query.mockImplementation((sql: string) => {
			if (sql.includes('FROM universe.list WHERE')) {
				return Promise.resolve({ rowCount: 1, rows: [{ name: 'Main St' }] });
			}
			return Promise.resolve({ rows: [], rowCount: 0 });
		});

		await expect(del()).rejects.toMatchObject({ status: 404 });
	});

	it('returns 400 for a malformed document id', async () => {
		await expect(del({ ...params, document_id: 'nope' })).rejects.toMatchObject({ status: 400 });
		expect(softDelete()).toBeUndefined();
	});

	it('returns 401 when signed out', async () => {
		await expect(del(params, {})).rejects.toMatchObject({ status: 401 });
	});

	it('returns 403 without staff access and deletes nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(del()).rejects.toMatchObject({ status: 403 });
		expect(softDelete()).toBeUndefined();
	});
});
