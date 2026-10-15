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

import { createBucketList, createList, listBucketLists, listListEntries } from './lists.service';
import { convertBucketFilter } from '$lib/server/filter-converter';
import type { BucketFilters } from '$lib/shared/types/filters';

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

describe('createList', () => {
	const LIST = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
	const EXPIRES = '2027-01-01T00:00:00.000Z';

	const austin = { item: 'city', operation: 'equals' as const, value: 'Austin' };
	const bucketFilters: BucketFilters = {
		v: 2,
		people: null,
		locations: { operator: 'AND', filters: [austin] }
	};

	const off = { enabled: false, matchType: 'ONE_OR_MORE' as const, conditions: [] };
	const locationsOnly = (conditions: { filterId: string; qualifierId: string; value: string }[]) =>
		convertBucketFilter({
			people: off,
			locations: { enabled: true, matchType: 'ALL', conditions }
		});
	const legacyBucket = locationsOnly([{ filterId: 'city', qualifierId: 'is', value: 'Austin' }]);
	const legacyBroken = locationsOnly([{ filterId: 'city', qualifierId: 'contains', value: '50%' }]);

	/** Answers the bucket lookup with `bucket` (null for none), and the list insert with an id. */
	function stubBucket(bucket: { filter: unknown; filters: unknown } | null = { filter: null, filters: bucketFilters }) {
		mockClient.query.mockImplementation(async (sql: string) => {
			if (sql.includes('FROM universe.bucket')) {
				return {
					rows: bucket
						? [{ id: BUCKET, org_id: ORG, name: 'Voters', slug: 'voters', created_at: 'then', ...bucket }]
						: []
				};
			}
			if (sql.includes('INSERT INTO universe.list ')) return { rows: [{ id: LIST }] };
			return { rows: [] };
		});
	}

	const base = { name: 'Doors', entity_type: 'locations' as const, expires_at: EXPIRES };
	const create = (input: Record<string, unknown> = {}) =>
		createList(mockClient as never, ORG, BUCKET, { ...base, ...input } as never);
	const run = (fragment: string) =>
		mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));

	beforeEach(() => stubBucket());

	it('returns the id of the list', async () => {
		expect(await create()).toEqual({ id: LIST });
	});

	it('looks the bucket up by id within the organization', async () => {
		await create();

		expect(String(run('FROM universe.bucket')![0])).toContain('org_id = $1 AND id = $2');
		expect(run('FROM universe.bucket')![1]).toEqual([ORG, BUCKET]);
	});

	it('answers 404 for a bucket that is not in the organization', async () => {
		stubBucket(null);

		await expect(create()).rejects.toMatchObject({ status: 404 });
		expect(run('INSERT INTO universe.list')).toBeUndefined();
	});

	it('answers 400 for a kind of record the bucket does not include', async () => {
		await expect(create({ entity_type: 'people' })).rejects.toMatchObject({ status: 400 });
		expect(run('INSERT INTO universe.list')).toBeUndefined();
	});

	it('answers 422 for a bucket whose old filter cannot be converted, and creates nothing', async () => {
		stubBucket({ filter: legacyBroken, filters: null });

		await expect(create()).rejects.toMatchObject({ status: 422 });
		expect(run('INSERT INTO universe.list')).toBeUndefined();
	});

	describe('which records it holds', () => {
		it("snapshots the bucket's matches when the list adds no filter", async () => {
			await create();

			const [sql, params] = run('INSERT INTO universe.list_entry')!;
			expect(String(sql)).toContain(
				'FROM (SELECT vl.id, vl.source FROM universe.v_locations vl WHERE (lower(vl.city) = lower($1))) matched'
			);
			expect(String(sql)).toContain('$2::uuid');
			expect(params).toEqual(['Austin', LIST]);
		});

		it("narrows the bucket's matches by the list's own filter", async () => {
			await create({
				filters: { operator: 'AND', filters: [{ item: 'zip_code', operation: 'starts_with', value: '787' }] }
			});

			const [sql, params] = run('INSERT INTO universe.list_entry')!;
			expect(String(sql).replace(/\s+/g, ' ')).toContain(
				'WHERE ((lower(vl.city) = lower($1)) AND (vl.postal_code ILIKE $2))'
			);
			expect(params).toEqual(['Austin', '787%', LIST]);
		});

		it('uses the converted old filter of a bucket that has not been converted', async () => {
			stubBucket({ filter: legacyBucket, filters: null });

			await create();

			expect(run('INSERT INTO universe.list_entry')![1]).toEqual(['Austin', LIST]);
		});

		it('answers 400, creating nothing, for a filter that does not apply to the kind of record', async () => {
			const name = { item: 'first_name', operation: 'equals', value: 'Al' };

			await expect(create({ filters: { operator: 'AND', filters: [name] } })).rejects.toMatchObject({
				status: 400
			});
			expect(run('INSERT INTO universe.list ')).toBeUndefined();
		});

		it('snapshots the locations that gave a survey response', async () => {
			const survey = {
				item: 'survey_question_response',
				operation: 'equals',
				value: { bucketId: BUCKET, surveyId: BUCKET, questionId: BUCKET, response: 'Yes' }
			};

			await create({ filters: { operator: 'AND', filters: [survey] } });

			const [sql, params] = run('INSERT INTO universe.list_entry')!;
			expect(String(sql)).toContain('FROM universe.survey_question_response sqr');
			expect(params).toEqual(['Austin', 'Yes', BUCKET, LIST]);
		});
	});

	describe('what it records about how it was made', () => {
		it("stores the bucket's filters when the list adds none", async () => {
			await create();

			expect(JSON.parse(run('INSERT INTO universe.list ')![1][5])).toEqual(bucketFilters.locations);
		});

		it("stores the bucket's and the list's filters together", async () => {
			const own = { operator: 'AND', filters: [{ item: 'zip_code', operation: 'starts_with', value: '787' }] };

			await create({ filters: own });

			expect(JSON.parse(run('INSERT INTO universe.list ')![1][5])).toEqual({
				operator: 'AND',
				filters: [bucketFilters.locations, own]
			});
		});

		it('scopes the list to the bucket and organization', async () => {
			await create();

			expect(run('INSERT INTO universe.list ')![1].slice(0, 5)).toEqual([
				'Doors',
				BUCKET,
				ORG,
				'locations',
				EXPIRES
			]);
		});

		it('creates the list before snapshotting into it', async () => {
			await create();

			const order = mockClient.query.mock.calls.map((c) => String(c[0]));
			expect(order.findIndex((q) => q.includes('INSERT INTO universe.list '))).toBeLessThan(
				order.findIndex((q) => q.includes('INSERT INTO universe.list_entry'))
			);
		});
	});
});

describe('createBucketList', () => {
	const input = { name: 'Doors', entity_type: 'locations' as const, expires_at: '2027-01-01T00:00:00.000Z' };

	it('answers 403 without staff access and creates nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(createBucketList('u1', BUCKET, input)).rejects.toMatchObject({ status: 403 });
		expect(mockClient.query.mock.calls.some((c) => String(c[0]).includes('INSERT INTO universe.list'))).toBe(false);
	});

	it("answers 404 when the bucket is in none of the caller's orgs", async () => {
		stub(false);

		await expect(createBucketList('u1', BUCKET, input)).rejects.toMatchObject({ status: 404 });
	});
});
