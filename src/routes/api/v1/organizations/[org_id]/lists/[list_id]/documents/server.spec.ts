import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factories, which vitest lifts above this file's consts,
// can still reach them.
const { mockClient, canOrg, generateListDocument } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn(),
	generateListDocument: vi.fn()
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
vi.mock('$lib/server/services/list-document.service', () => ({ generateListDocument }));

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LIST = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';

const params = { org_id: ORG, list_id: LIST };
const staff = { user: { id: 'u1' } };

function call(p: Record<string, string>, locals: object) {
	return POST({ params: p, locals } as never);
}

async function status(p: Record<string, string>, locals: object): Promise<number> {
	try {
		const res = await call(p, locals);
		return res.status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}

/** Answers each query by the first matching SQL fragment. */
function stubQueries(listExists: boolean) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM universe.list WHERE')) {
			return Promise.resolve({
				rowCount: listExists ? 1 : 0,
				rows: listExists ? [{ name: 'Main St' }] : []
			});
		}
		if (sql.includes('FROM universe.list_document')) {
			return Promise.resolve({ rowCount: 1, rows: [{ id: 'd1', status: 'ready' }] });
		}
		if (sql.includes('INSERT INTO universe.list_document')) {
			return Promise.resolve({
				rows: [
					{
						id: values![0],
						list_id: values![2],
						storage_key: values![3],
						status: 'pending',
						created_at: '2026-09-24T00:00:00Z'
					}
				]
			});
		}
		return Promise.resolve({ rows: [], rowCount: 0 });
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stubQueries(true);
});

describe('POST list documents', () => {
	it('returns 202 with the pending document and where to poll it', async () => {
		const res = await call(params, staff);
		const body = await res.json();

		expect(res.status).toBe(202);
		expect(body).toMatchObject({ list_id: LIST, status: 'pending' });
		expect(res.headers.get('Location')).toBe(
			`/api/v1/organizations/${ORG}/lists/${LIST}/documents/${body.id}`
		);
	});

	it('reserves a storage key under the org and list', async () => {
		await call(params, staff);

		const insert = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('INSERT INTO universe.list_document')
		)!;
		const [id, orgId, listId, key, userId] = insert[1] as string[];

		expect([orgId, listId, userId]).toEqual([ORG, LIST, 'u1']);
		expect(key).toBe(`orgs/${ORG}/lists/${LIST}/documents/${id}.pdf`);
	});

	it('starts generation for the new document', async () => {
		const res = await call(params, staff);
		const { id } = await res.json();

		expect(generateListDocument).toHaveBeenCalledWith({
			orgId: ORG,
			documentId: id,
			listId: LIST,
			storageKey: `orgs/${ORG}/lists/${LIST}/documents/${id}.pdf`
		});
	});

	it('soft-deletes the list\'s earlier documents before creating the new one', async () => {
		await call(params, staff);

		const sql = mockClient.query.mock.calls.map((c) => String(c[0]));
		const supersede = sql.findIndex((q) => q.includes('SET deleted_at = now()'));
		const insert = sql.findIndex((q) => q.includes('INSERT INTO universe.list_document'));

		expect(supersede).toBeGreaterThan(-1);
		expect(supersede).toBeLessThan(insert);
		expect(sql[supersede]).toContain('list_id = $1 AND org_id = $2 AND deleted_at IS NULL');
		expect(mockClient.query.mock.calls[supersede][1]).toEqual([LIST, ORG]);
	});

	it('scopes the list lookup to the org', async () => {
		await call(params, staff);

		const lookup = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('FROM universe.list WHERE')
		)!;
		expect(lookup[0]).toContain('org_id = $2');
		expect(lookup[1]).toEqual([LIST, ORG]);
	});

	it('returns 401 when signed out', async () => {
		expect(await status(params, {})).toBe(401);
	});

	it('returns 400 for a malformed list id', async () => {
		expect(await status({ org_id: ORG, list_id: 'nope' }, staff)).toBe(400);
	});

	it('returns 400 for a malformed org id', async () => {
		expect(await status({ org_id: 'nope', list_id: LIST }, staff)).toBe(400);
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		expect(await status(params, staff)).toBe(403);
		expect(generateListDocument).not.toHaveBeenCalled();
	});

	it('returns 404 when the list is not in the org', async () => {
		stubQueries(false);

		expect(await status(params, staff)).toBe(404);
		expect(generateListDocument).not.toHaveBeenCalled();
	});
});

describe('GET list documents', () => {
	it('returns the documents scoped to the list and org', async () => {
		const res = await GET({ params, locals: staff } as never);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([{ id: 'd1', status: 'ready' }]);

		const select = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('FROM universe.list_document')
		)!;
		expect(select[1]).toEqual([LIST, ORG]);
		expect(select[0]).toContain('deleted_at IS NULL');
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(GET({ params, locals: staff } as never)).rejects.toMatchObject({ status: 403 });
	});

	it('returns 404 when the list is not in the org', async () => {
		stubQueries(false);

		await expect(GET({ params, locals: staff } as never)).rejects.toMatchObject({ status: 404 });
	});
});
