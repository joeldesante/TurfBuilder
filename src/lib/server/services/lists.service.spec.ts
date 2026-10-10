import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: mockClient.query,
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const found = { rowCount: 1, rows: [{ id: BUCKET }] };

import { listBucketLists, listListEntries } from './lists.service';

function stub(member = true) {
	mockClient.query.mockImplementation((sql: string) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		return Promise.resolve(found);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('listBucketLists', () => {
	it("selects the bucket's lists scoped to the org", async () => {
		await listBucketLists('u1', BUCKET);

		const select = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('FROM universe.list')
		)!;
		expect(select[0]).toContain('bucket = $1 AND org_id = $2');
		expect(select[1]).toEqual([BUCKET, ORG]);
	});

	it("returns 404 when the bucket is in none of the caller's orgs", async () => {
		stub(false);

		await expect(listBucketLists('u1', BUCKET)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listBucketLists('u1', BUCKET)).rejects.toMatchObject({ status: 403 });
	});
});

describe('listListEntries', () => {
	const LIST = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
	const entries = [{ record_id: 'e1' }];

	function stubList(entityType: 'people' | 'locations', total: number) {
		mockClient.query.mockImplementation((sql: string) => {
			if (sql.includes('FROM auth.member')) {
				return Promise.resolve({ rowCount: 1, rows: [{ organization_id: ORG }] });
			}
			if (sql.includes('SELECT 1 FROM universe.list')) return Promise.resolve(found);
			if (sql.includes('SELECT name FROM universe.list')) {
				return Promise.resolve({ rowCount: 1, rows: [{ name: 'L' }] });
			}
			if (sql.includes('SELECT entity_type')) {
				return Promise.resolve({ rowCount: 1, rows: [{ entity_type: entityType }] });
			}
			if (sql.includes('COUNT(*)')) return Promise.resolve({ rows: [{ count: String(total) }] });
			return Promise.resolve({ rowCount: entries.length, rows: entries });
		});
	}

	const paged = () =>
		mockClient.query.mock.calls.find((c) => String(c[0]).includes('LIMIT $3 OFFSET $4'))!;

	it('returns the page with the total', async () => {
		stubList('locations', 250);

		expect(await listListEntries('u1', LIST, 2)).toEqual({
			items: entries,
			totalCount: 250,
			page: 2,
			pageSize: 100
		});
	});

	it('scopes the count and page to the list and its org', async () => {
		stubList('locations', 250);

		await listListEntries('u1', LIST, 3);

		const count = mockClient.query.mock.calls.find((c) => String(c[0]).includes('COUNT(*)'))!;
		expect(String(count[0])).toContain('l.org_id = $2');
		expect(count[1]).toEqual([LIST, ORG]);
		expect(String(paged()[0])).toContain('l.org_id = $2');
		expect(paged()[1]).toEqual([LIST, ORG, 100, 200]);
	});

	it('reads the snapshotted people for a people list', async () => {
		stubList('people', 1);

		await listListEntries('u1', LIST, 1);

		expect(String(paged()[0])).toContain('universe.org_person op');
	});

	it('reads the snapshotted locations for a locations list', async () => {
		stubList('locations', 1);

		await listListEntries('u1', LIST, 1);

		expect(String(paged()[0])).toContain('universe.org_location ol');
	});

	it('orders with an entry id tiebreak, so pages cannot repeat or skip an entry', async () => {
		stubList('locations', 1);

		await listListEntries('u1', LIST, 1);

		expect(String(paged()[0]).replace(/\s+/g, ' ')).toContain('le.id LIMIT $3 OFFSET $4');
	});

	it('never reads the current version in place of the snapshot', async () => {
		stubList('people', 1);

		await listListEntries('u1', LIST, 1);

		expect(String(paged()[0])).not.toContain('valid_to');
	});

	it('answers 403 without staff access and reads no entries', async () => {
		stubList('locations', 1);
		canOrg.mockResolvedValue(false);

		await expect(listListEntries('u1', LIST, 1)).rejects.toMatchObject({ status: 403 });
		expect(
			mockClient.query.mock.calls.find((c) => String(c[0]).includes('universe.list_entry'))
		).toBeUndefined();
	});

	it("answers 404 when the list is in none of the caller's orgs", async () => {
		stub(false);

		await expect(listListEntries('u1', LIST, 1)).rejects.toMatchObject({ status: 404 });
	});
});
