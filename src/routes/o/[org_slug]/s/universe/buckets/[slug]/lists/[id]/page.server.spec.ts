import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factory, which vitest lifts above this file's consts,
// can still reach it.
const { mockClient } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() }
}));

vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

import { load } from './+page.server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LIST = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';

const list = {
	id: LIST,
	name: 'Main St',
	entity_type: 'locations',
	expires_at: '2026-10-08T12:00:00Z',
	created_at: '2026-09-24T12:00:00Z'
};

/** Answers each query the load issues; `pdfs` is how many current, ready PDFs exist. */
function stub({ listFound = true, pdfs = 0 } = {}) {
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('FROM universe.list l')) return { rows: listFound ? [list] : [] };
		if (sql.includes('FROM universe.list_document'))
			return { rows: Array(pdfs).fill({ '?column?': 1 }), rowCount: pdfs };
		return { rows: [], rowCount: 0 };
	});
}

function event(locals: object = { organization: { id: ORG } }) {
	return { params: { id: LIST, slug: 'downtown' }, locals } as never;
}

function pdfQuery() {
	return mockClient.query.mock.calls.find((c) =>
		String(c[0]).includes('FROM universe.list_document')
	)!;
}

beforeEach(() => {
	vi.clearAllMocks();
	stub();
});

describe('list detail page load', () => {
	it('throws 401 without an organization', async () => {
		await expect(load(event({}))).rejects.toMatchObject({ status: 401 });
	});

	it('throws 404 when the list is not in this org and bucket', async () => {
		stub({ listFound: false });

		await expect(load(event())).rejects.toMatchObject({ status: 404 });
	});

	it('reports no pdf when the list has none', async () => {
		const data = await load(event());

		expect(data).toMatchObject({ list, hasPdf: false });
	});

	it('reports a pdf when the list has a ready one', async () => {
		stub({ pdfs: 1 });

		expect(await load(event())).toMatchObject({ hasPdf: true });
	});

	// Pending, failed, and replaced documents have nothing to download.
	it('only counts ready documents that have not been replaced, in this org', async () => {
		await load(event());

		const [sql, params] = pdfQuery();
		expect(sql).toContain("status = 'ready'");
		expect(sql).toContain('deleted_at IS NULL');
		expect(sql).toContain('org_id = $2');
		expect(params).toEqual([LIST, ORG]);
	});
});
