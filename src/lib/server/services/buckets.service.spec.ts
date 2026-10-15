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
const stored: BucketFilters = {
	v: 2,
	people: null,
	locations: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Austin' }] }
};
const found = { rowCount: 1, rows: [{ id: BUCKET, filters: stored }] };

import type { BucketFilters } from '$lib/shared/types/filters';
import { convertBucketFilter } from '$lib/server/filter-converter';
import {
	listBuckets,
	createBucket,
	getBucket,
	replaceBucket,
	updateBucket,
	listBucketLocations,
	listBucketPeople,
	bucketSections,
	convertAllBucketFilters,
	findBucketBySlug,
	findBucketForPage,
	listBucketNavigation,
	queryBucketEntitiesPage,
	resolveBucketFilters,
	UnconvertibleBucketError
} from './buckets.service';

const input = { name: 'Voters', slug: 'voters', filters: stored };

/** Answers membership, the bucket-in-org lookup, and everything else with `rest`. */
function stub(rest: (sql: string, values?: unknown[]) => unknown = () => found, member = true) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('SELECT 1 FROM universe.bucket')) return Promise.resolve(found);
		return Promise.resolve(rest(sql, values));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('listBuckets', () => {
	it("selects only the org's buckets", async () => {
		await listBuckets('u1', ORG);

		expect(sqlRun('FROM universe.bucket WHERE org_id = $1')![1]).toEqual([ORG]);
	});

	it('returns 404 for a non-member and queries nothing', async () => {
		stub(() => found, false);

		await expect(listBuckets('u1', ORG)).rejects.toMatchObject({ status: 404 });
		expect(sqlRun('FROM universe.bucket WHERE org_id')).toBeUndefined();
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listBuckets('u1', ORG)).rejects.toMatchObject({ status: 403 });
	});
});

describe('createBucket', () => {
	it('inserts into the org with the filters as JSON', async () => {
		await createBucket('u1', ORG, input);

		expect(sqlRun('INSERT INTO universe.bucket')![1]).toEqual([
			'Voters',
			'voters',
			ORG,
			JSON.stringify(input.filters)
		]);
	});

	it('returns 409 when the slug is taken', async () => {
		stub((sql) => {
			if (sql.includes('INSERT INTO universe.bucket'))
				throw Object.assign(new Error(), { code: '23505' });
			return found;
		});

		await expect(createBucket('u1', ORG, input)).rejects.toMatchObject({ status: 409 });
	});

	it('returns 403 without staff access and inserts nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(createBucket('u1', ORG, input)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('INSERT INTO')).toBeUndefined();
	});
});

describe('getBucket', () => {
	it('scopes the select to the bucket and org', async () => {
		await getBucket('u1', BUCKET);

		expect(sqlRun('WHERE id = $1 AND org_id = $2')![1]).toEqual([BUCKET, ORG]);
	});

	it('returns 404 when no org of the caller has it', async () => {
		stub(() => found, false);

		await expect(getBucket('u1', BUCKET)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(getBucket('u1', BUCKET)).rejects.toMatchObject({ status: 403 });
	});
});

describe('replaceBucket and updateBucket', () => {
	it('replace sends all three fields', async () => {
		await replaceBucket('u1', BUCKET, input);

		expect(sqlRun('UPDATE universe.bucket')![1]).toEqual([
			BUCKET,
			ORG,
			'Voters',
			'voters',
			JSON.stringify(input.filters)
		]);
	});

	it('update sends null for the fields left out so they keep their value', async () => {
		await updateBucket('u1', BUCKET, { name: 'New' });

		expect(sqlRun('UPDATE universe.bucket')![1]).toEqual([BUCKET, ORG, 'New', null, null]);
	});

	it('returns 409 when the slug is taken', async () => {
		stub((sql) => {
			if (sql.includes('UPDATE universe.bucket'))
				throw Object.assign(new Error(), { code: '23505' });
			return found;
		});

		await expect(updateBucket('u1', BUCKET, { slug: 'x' })).rejects.toMatchObject({
			status: 409
		});
	});

	it('returns 403 without staff access and updates nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(updateBucket('u1', BUCKET, { name: 'x' })).rejects.toMatchObject({
			status: 403
		});
		expect(sqlRun('UPDATE universe.bucket')).toBeUndefined();
	});
});

const off = { enabled: false, matchType: 'ONE_OR_MORE' as const, conditions: [] };
const legacyAustin = convertBucketFilter({
	people: off,
	locations: {
		enabled: true,
		matchType: 'ALL',
		conditions: [{ filterId: 'city', qualifierId: 'is', value: 'Austin' }]
	}
});
const legacyBroken = convertBucketFilter({
	people: off,
	locations: {
		enabled: true,
		matchType: 'ALL',
		conditions: [{ filterId: 'city', qualifierId: 'contains', value: '50%' }]
	}
});

describe('buckets made before the filter editor', () => {
	const row = (filter: unknown, filters: unknown = null) => ({
		rowCount: 1,
		rows: [{ id: BUCKET, org_id: ORG, name: 'Old', slug: 'old', filter, filters, created_at: 'then' }]
	});

	function stubRow(filter: unknown, filters: unknown = null) {
		stub((sql) =>
			sql.startsWith('SELECT id, org_id')
				? row(filter, filters)
				: sql.includes('UPDATE universe.bucket SET filters')
					? { rowCount: 1, rows: [] }
					: found
		);
	}

	it('converts the old filter when the bucket is read, and saves the result', async () => {
		stubRow(legacyAustin);

		const bucket = await getBucket('u1', BUCKET);

		expect(bucket.filters?.locations?.filters).toEqual([
			{ item: 'city', operation: 'equals', value: 'Austin', caseSensitive: true }
		]);
		expect(String(sqlRun('UPDATE universe.bucket SET filters')![0])).toContain('filters IS NULL');
	});

	it('does not return the old filter column', async () => {
		stubRow(legacyAustin);

		expect(await getBucket('u1', BUCKET)).not.toHaveProperty('filter');
	});

	it('leaves the old filter alone', async () => {
		stubRow(legacyAustin);

		await getBucket('u1', BUCKET);

		expect(String(sqlRun('UPDATE universe.bucket SET filters')![0])).not.toMatch(/SET filter\b/);
	});

	it('returns null filters, rather than failing, for one that cannot be converted', async () => {
		stubRow(legacyBroken);

		expect(await getBucket('u1', BUCKET)).toMatchObject({ id: BUCKET, filters: null });
		expect(sqlRun('UPDATE universe.bucket SET filters')).toBeUndefined();
	});

	it('does not convert a bucket that already has filters', async () => {
		stubRow(legacyAustin, stored);

		expect((await getBucket('u1', BUCKET)).filters).toEqual(stored);
		expect(sqlRun('UPDATE universe.bucket SET filters')).toBeUndefined();
	});

	it('converts each bucket in a listing, and a broken one does not hide the rest', async () => {
		stub((sql) =>
			sql.startsWith('SELECT id, org_id')
				? {
						rowCount: 2,
						rows: [
							{ id: 'a', filter: legacyBroken, filters: null },
							{ id: 'b', filter: legacyAustin, filters: null }
						]
					}
				: { rowCount: 1, rows: [] }
		);

		const buckets = await listBuckets('u1', ORG);

		expect(buckets.map((b) => b.filters === null)).toEqual([true, false]);
	});
});

describe('listBucketLocations and listBucketPeople', () => {
	function stubFilter(total: number, filters: unknown = stored, filter: unknown = null) {
		stub((sql) => {
			if (sql.startsWith('SELECT id, org_id')) {
				return { rowCount: 1, rows: [{ id: BUCKET, filter, filters }] };
			}
			if (sql.includes('COUNT(*)')) return { rows: [{ count: String(total) }] };
			return { rowCount: 1, rows: [{ id: 'l1' }] };
		});
	}

	it("returns a page of the bucket's matches with the total", async () => {
		stubFilter(250);

		expect(await listBucketLocations('u1', BUCKET, 2)).toEqual({
			items: [{ id: 'l1' }],
			totalCount: 250,
			page: 2,
			pageSize: 100
		});
	});

	it("compiles the bucket's filters, with the columns the page shows", async () => {
		stubFilter(1);

		await listBucketLocations('u1', BUCKET, 1);

		const count = sqlRun('COUNT(*)')!;
		expect(String(count[0])).toContain('SELECT vl.id, vl.name, vl.address_line_1');
		expect(String(count[0])).toContain('lower(vl.city) = lower($1)');
		expect(count[1]).toEqual(['Austin']);
	});

	it("reads the bucket's filters within its org", async () => {
		stubFilter(1);

		await listBucketLocations('u1', BUCKET, 1);

		expect(sqlRun('SELECT id, org_id')![1]).toEqual([BUCKET, ORG]);
	});

	it('orders locations by name with an id tiebreak', async () => {
		stubFilter(1);

		await listBucketLocations('u1', BUCKET, 1);

		expect(sqlRun('LIMIT $2 OFFSET $3')![0]).toContain(
			'ORDER BY name NULLS LAST, address_line_1 NULLS LAST, id'
		);
	});

	it('returns an empty page when the bucket does not include that entity', async () => {
		stubFilter(1);

		expect(await listBucketPeople('u1', BUCKET, 4)).toEqual({
			items: [],
			totalCount: 0,
			page: 1,
			pageSize: 100
		});
		expect(sqlRun('COUNT(*)')).toBeUndefined();
	});

	it('uses the converted old filter for a bucket that has not been converted', async () => {
		stubFilter(1, null, legacyAustin);

		await listBucketLocations('u1', BUCKET, 1);

		expect(sqlRun('COUNT(*)')![1]).toEqual(['Austin']);
	});

	it('answers 422 for a bucket whose old filter cannot be converted', async () => {
		stubFilter(1, null, legacyBroken);

		await expect(listBucketLocations('u1', BUCKET, 1)).rejects.toMatchObject({ status: 422 });
		expect(sqlRun('COUNT(*)')).toBeUndefined();
	});

	it('answers 403 without staff access', async () => {
		stubFilter(1);
		canOrg.mockResolvedValue(false);

		await expect(listBucketLocations('u1', BUCKET, 1)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('SELECT id, org_id')).toBeUndefined();
	});

	it("answers 404 when the bucket is in none of the caller's orgs", async () => {
		stub(undefined, false);

		await expect(listBucketLocations('u1', BUCKET, 1)).rejects.toMatchObject({ status: 404 });
	});
});

describe('resolveBucketFilters', () => {
	const row = (change = {}) => ({ id: BUCKET, filter: legacyAustin, filters: null, ...change });
	const resolve = (r = row()) => resolveBucketFilters(mockClient as never, ORG, r);

	beforeEach(() => {
		mockClient.query.mockResolvedValue({ rowCount: 1, rows: [] });
	});

	it('returns the stored filters without touching the database or the old filter', async () => {
		expect(await resolve(row({ filter: 'not even json', filters: stored }))).toEqual(stored);
		expect(mockClient.query).not.toHaveBeenCalled();
	});

	it('refuses stored filters that are not valid, instead of using them', async () => {
		await expect(resolve(row({ filters: { v: 2, people: 'nope', locations: null } }))).rejects.toThrow(
			/invalid filters/
		);
	});

	it('converts the old filter when there are none, and saves the result', async () => {
		const result = await resolve();

		expect(result.locations?.filters).toEqual([
			{ item: 'city', operation: 'equals', value: 'Austin', caseSensitive: true }
		]);
		expect(result.people).toBeNull();
		expect(sqlRun('UPDATE universe.bucket')![1]).toEqual([BUCKET, ORG, JSON.stringify(result)]);
	});

	it('saves only if nothing has been saved, so concurrent requests cannot overwrite each other', async () => {
		await resolve();

		expect(String(sqlRun('UPDATE universe.bucket')![0])).toContain('filters IS NULL');
		expect(String(sqlRun('UPDATE universe.bucket')![0])).toContain('org_id = $2');
	});

	it("uses another request's filters if it saved first", async () => {
		mockClient.query.mockImplementation(async (text: string) =>
			text.includes('UPDATE')
				? { rowCount: 0, rows: [] }
				: { rowCount: 1, rows: [{ filters: stored }] }
		);

		expect(await resolve()).toEqual(stored);
	});

	it('treats a bucket with no old filter either as including nothing', async () => {
		expect(await resolve(row({ filter: null }))).toEqual({ v: 2, people: null, locations: null });
	});

	it('throws, and saves nothing, when the old filter cannot be converted', async () => {
		const attempt = resolve(row({ filter: legacyBroken }));

		await expect(attempt).rejects.toBeInstanceOf(UnconvertibleBucketError);
		await expect(attempt).rejects.toMatchObject({
			bucketId: BUCKET,
			reason: expect.stringContaining('locations:')
		});
		expect(sqlRun('UPDATE universe.bucket')).toBeUndefined();
	});
});

describe('bucketSections', () => {
	it('reports which kinds of record a bucket includes', () => {
		expect(bucketSections(stored)).toEqual({ people: { enabled: false }, locations: { enabled: true } });
		expect(bucketSections({ v: 2, people: { operator: 'AND', filters: [] }, locations: null })).toEqual({
			people: { enabled: true },
			locations: { enabled: false }
		});
	});
});

describe('convertAllBucketFilters', () => {
	function answer(orgs: string[], buckets: Record<string, unknown[]>) {
		mockClient.query.mockImplementation(async (text: string, values?: unknown[]) => {
			if (text.includes('FROM auth.organization')) return { rows: orgs.map((id) => ({ id })) };
			if (text.includes('SELECT id, slug, filter, filters')) {
				return { rows: buckets[String((values as string[])[0])] ?? [] };
			}
			return { rowCount: 1, rows: [] };
		});
	}

	it('converts each bucket that has not been and counts the ones that have', async () => {
		answer([ORG], {
			[ORG]: [
				{ id: 'a', slug: 'a', filter: legacyAustin, filters: null },
				{ id: 'b', slug: 'b', filter: legacyAustin, filters: stored }
			]
		});

		expect(await convertAllBucketFilters()).toEqual({ converted: 1, alreadyDone: 1, failed: [] });
	});

	it('reports the buckets it could not convert and carries on with the rest', async () => {
		answer([ORG], {
			[ORG]: [
				{ id: 'bad', slug: 'bad-bucket', filter: legacyBroken, filters: null },
				{ id: 'good', slug: 'good', filter: legacyAustin, filters: null }
			]
		});

		const report = await convertAllBucketFilters();

		expect(report.converted).toBe(1);
		expect(report.failed).toEqual([
			{ orgId: ORG, bucketId: 'bad', slug: 'bad-bucket', reason: expect.stringContaining('locations:') }
		]);
	});

	it('works through every organization, each in its own transaction', async () => {
		const other = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
		answer([ORG, other], {
			[ORG]: [{ id: 'a', slug: 'a', filter: legacyAustin, filters: null }],
			[other]: [{ id: 'b', slug: 'b', filter: legacyAustin, filters: null }]
		});

		expect((await convertAllBucketFilters()).converted).toBe(2);
		const contexts = mockClient.query.mock.calls.filter((c) => String(c[0]).startsWith('SET LOCAL'));
		expect(contexts.map((c) => c[0])).toEqual([
			`SET LOCAL app.current_org_id = '${ORG}'`,
			`SET LOCAL app.current_org_id = '${other}'`
		]);
	});

	it('finds nothing to do when there are no buckets', async () => {
		answer([ORG], {});

		expect(await convertAllBucketFilters()).toEqual({ converted: 0, alreadyDone: 0, failed: [] });
	});
});

describe('queryBucketEntitiesPage', () => {
	const austin = {
		operator: 'AND' as const,
		filters: [{ item: 'city', operation: 'equals' as const, value: 'Austin' }]
	};
	const rows = [{ id: 'a' }];

	/** Answers the COUNT with `total` and the page query with `rows`. */
	function answer(total: number) {
		mockClient.query.mockImplementation(async (text: string) =>
			text.includes('COUNT(*)') ? { rows: [{ count: String(total) }] } : { rows }
		);
	}
	const pageCall = () => mockClient.query.mock.calls.find((c) => !String(c[0]).includes('COUNT(*)'))!;
	const run = (page: number, kind: 'locations' | 'people' = 'locations', size?: number) =>
		queryBucketEntitiesPage(mockClient as never, kind, kind === 'locations' ? austin : { operator: 'AND', filters: [] }, page, size);

	beforeEach(() => answer(250));

	it('returns the rows with the total, page, and page size', async () => {
		expect(await run(2)).toEqual({ items: rows, totalCount: 250, page: 2, pageSize: 100 });
	});

	it('selects the columns the locations page shows', async () => {
		await run(1);

		const [sql, params] = mockClient.query.mock.calls[0];
		expect(String(sql)).toContain(
			'FROM (SELECT vl.id, vl.name, vl.address_line_1, vl.address_line_2, vl.city, vl.state_or_region, vl.postal_code' +
				' FROM universe.v_locations vl WHERE (lower(vl.city) = lower($1))) q'
		);
		expect(String(sql)).not.toContain(';');
		expect(params).toEqual(['Austin']);
	});

	it('selects the columns the people page shows', async () => {
		await run(1, 'people');

		expect(String(mockClient.query.mock.calls[0][0])).toContain(
			'SELECT vp.id, vp.first_name, vp.last_name, vp.email, vp.phone, vp.dob FROM universe.v_people vp'
		);
	});

	it('orders each kind with an id tiebreak, so pages cannot repeat or skip a row', async () => {
		await run(1);
		expect(String(pageCall()[0])).toContain('ORDER BY name NULLS LAST, address_line_1 NULLS LAST, id LIMIT $2 OFFSET $3');

		mockClient.query.mockClear();
		await run(1, 'people');
		expect(String(pageCall()[0])).toContain('ORDER BY last_name NULLS LAST, first_name NULLS LAST, id LIMIT $1 OFFSET $2');
	});

	it('offsets by whole pages', async () => {
		await run(3);

		expect(pageCall()[1]).toEqual(['Austin', 100, 200]);
	});

	it('honors a page size', async () => {
		await run(2, 'locations', 10);

		expect(pageCall()[1]).toEqual(['Austin', 10, 10]);
	});

	it.each([
		['past the end', 99, 3],
		['zero', 0, 1],
		['negative', -4, 1],
		['not a number', NaN, 1]
	])('clamps a page number %s', async (_name, requested, expected) => {
		expect((await run(requested)).page).toBe(expected);
	});

	it('returns page 1 when nothing matches', async () => {
		answer(0);

		expect(await run(5)).toMatchObject({ totalCount: 0, page: 1 });
		expect(pageCall()[1]).toEqual(['Austin', 100, 0]);
	});
});

describe('finding a bucket by slug', () => {
	const rowOf = (change = {}) => ({
		id: BUCKET,
		org_id: ORG,
		name: 'Voters',
		slug: 'voters',
		filter: null,
		filters: stored,
		created_at: 'then',
		...change
	});

	it('returns the bucket with its filters', async () => {
		stub(() => ({ rowCount: 1, rows: [rowOf()] }));

		expect(await findBucketBySlug(mockClient as never, ORG, 'voters')).toEqual({
			id: BUCKET,
			name: 'Voters',
			slug: 'voters',
			filters: stored
		});
		expect(sqlRun('WHERE org_id = $1 AND slug = $2')![1]).toEqual([ORG, 'voters']);
	});

	it('returns null when the organization has no such bucket', async () => {
		stub(() => ({ rowCount: 0, rows: [] }));

		expect(await findBucketBySlug(mockClient as never, ORG, 'nope')).toBeNull();
	});

	it('converts an old filter on the way', async () => {
		stub((sql) =>
			sql.startsWith('SELECT id, org_id')
				? { rowCount: 1, rows: [rowOf({ filter: legacyAustin, filters: null })] }
				: { rowCount: 1, rows: [] }
		);

		const bucket = await findBucketBySlug(mockClient as never, ORG, 'voters');

		expect(bucket?.filters.locations?.filters).toHaveLength(1);
	});

	it('answers 422, saying why, for a bucket that cannot be converted', async () => {
		stub(() => ({ rowCount: 1, rows: [rowOf({ filter: legacyBroken, filters: null })] }));

		await expect(findBucketBySlug(mockClient as never, ORG, 'voters')).rejects.toMatchObject({
			status: 422
		});
	});
});

describe('listBucketNavigation', () => {
	it('lists the buckets by name with the kinds of record each includes', async () => {
		stub(() => ({
			rowCount: 2,
			rows: [
				{ id: 'a', name: 'A', slug: 'a', filter: null, filters: stored },
				{ id: 'b', name: 'B', slug: 'b', filter: legacyBroken, filters: null }
			]
		}));

		const nav = await listBucketNavigation(mockClient as never, ORG);

		expect(nav).toEqual([
			{ id: 'a', name: 'A', slug: 'a', filter: { people: { enabled: false }, locations: { enabled: true } } },
			// Kept in the list, with nothing to open
			{ id: 'b', name: 'B', slug: 'b', filter: { people: { enabled: false }, locations: { enabled: false } } }
		]);
		expect(String(sqlRun('FROM universe.bucket WHERE org_id = $1')![0])).toContain('ORDER BY name');
	});
});

describe('converting buckets whose stored filter is malformed', () => {
	const attemptNode = {
		v: 1,
		people: { enabled: false, query: null },
		locations: {
			enabled: true,
			query: {
				select: ['vl.id'],
				from: 'universe.v_locations vl',
				where: {
					type: 'group',
					connector: 'AND',
					negate: false,
					children: [{ type: 'attempt', op: 'not_attempted', scope: 'latest', negate: false }]
				}
			}
		}
	};

	function answer(rows: unknown[]) {
		mockClient.query.mockImplementation(async (text: string) => {
			if (text.includes('FROM auth.organization')) return { rows: [{ id: ORG }] };
			if (text.includes('SELECT id, slug, filter, filters')) return { rows };
			return { rowCount: 1, rows: [] };
		});
	}

	it('reports an unknown kind of condition and finishes the rest', async () => {
		answer([
			{ id: 'odd', slug: 'unvisited-places', filter: attemptNode, filters: null },
			{ id: 'good', slug: 'good', filter: legacyAustin, filters: null }
		]);

		const report = await convertAllBucketFilters();

		expect(report.converted).toBe(1);
		expect(report.failed).toEqual([
			expect.objectContaining({ slug: 'unvisited-places', reason: expect.stringContaining('"attempt"') })
		]);
	});

	it('reports a format it does not know, instead of emptying the bucket', async () => {
		answer([{ id: 'odd', slug: 'all', filter: { v: 1, input: {} }, filters: null }]);

		const report = await convertAllBucketFilters();

		expect(report.converted).toBe(0);
		expect(report.failed).toEqual([expect.objectContaining({ slug: 'all' })]);
		expect(mockClient.query.mock.calls.some((c) => String(c[0]).includes('UPDATE universe.bucket'))).toBe(false);
	});

	it('reports an unexpected error as a failure, so one bucket cannot stop the migration', async () => {
		const explodes = {
			v: 1,
			people: { enabled: false, query: null },
			get locations(): never {
				throw new TypeError('boom');
			}
		};
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
		answer([
			{ id: 'bad', slug: 'bad', filter: explodes, filters: null },
			{ id: 'good', slug: 'good', filter: legacyAustin, filters: null }
		]);

		const report = await convertAllBucketFilters();

		expect(report.converted).toBe(1);
		expect(report.failed).toEqual([
			expect.objectContaining({ slug: 'bad', reason: 'unexpected error while converting: boom' })
		]);
		quiet.mockRestore();
	});
});

describe('findBucketForPage', () => {
	const rowOf = (change = {}) => ({
		id: BUCKET,
		org_id: ORG,
		name: 'Voters',
		slug: 'voters',
		filter: null,
		filters: stored,
		created_at: 'then',
		...change
	});

	it('returns the bucket with its filters and no problem', async () => {
		stub(() => ({ rowCount: 1, rows: [rowOf()] }));

		expect(await findBucketForPage(mockClient as never, ORG, 'voters')).toEqual({
			id: BUCKET,
			name: 'Voters',
			slug: 'voters',
			filters: stored,
			problem: null
		});
	});

	it('returns null when the organization has no such bucket', async () => {
		stub(() => ({ rowCount: 0, rows: [] }));

		expect(await findBucketForPage(mockClient as never, ORG, 'nope')).toBeNull();
	});

	it('still returns a bucket whose old filter cannot be converted, saying why, so it can be rebuilt', async () => {
		stub(() => ({ rowCount: 1, rows: [rowOf({ filter: legacyBroken, filters: null })] }));

		const bucket = await findBucketForPage(mockClient as never, ORG, 'voters');

		expect(bucket).toMatchObject({ id: BUCKET, name: 'Voters', filters: null });
		expect(bucket?.problem).toContain('could not be converted');
		expect(sqlRun('UPDATE universe.bucket SET filters')).toBeUndefined();
	});

	it('converts an old filter on the way, as the strict version does', async () => {
		stub((sql) =>
			sql.startsWith('SELECT id, org_id')
				? { rowCount: 1, rows: [rowOf({ filter: legacyAustin, filters: null })] }
				: { rowCount: 1, rows: [] }
		);

		const bucket = await findBucketForPage(mockClient as never, ORG, 'voters');

		expect(bucket?.filters?.locations?.filters).toHaveLength(1);
		expect(bucket?.problem).toBeNull();
	});
});
