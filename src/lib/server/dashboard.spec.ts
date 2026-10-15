import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardPoints, getDashboardProgress } from './dashboard';
import type { BucketFilters } from '$lib/shared/types/filters';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';

const client = { query: vi.fn() };

const filters = (locations: BucketFilters['locations']): BucketFilters => ({
	v: 2,
	people: null,
	locations
});
const austin: BucketFilters['locations'] = {
	operator: 'AND',
	filters: [{ item: 'city', operation: 'equals', value: 'Austin' }]
};

beforeEach(() => {
	vi.clearAllMocks();
	client.query.mockResolvedValue({ rows: [{}] });
});

const flat = (sql: unknown) => String(sql).replace(/\s+/g, ' ');

describe('getDashboardProgress', () => {
	it('counts every location when no bucket is chosen', async () => {
		await getDashboardProgress(client as never, ORG, null);

		const [sql, params] = client.query.mock.calls[0];
		expect(flat(sql)).toContain('SELECT entity_id FROM universe.v_locations');
		expect(params).toEqual([ORG, null, null]);
	});

	it("scopes to the locations the bucket's filters match", async () => {
		await getDashboardProgress(client as never, ORG, { id: BUCKET, filters: filters(austin) });

		const [sql, params] = client.query.mock.calls[0];
		expect(flat(sql)).toContain(
			'SELECT vl.entity_id FROM universe.v_locations vl WHERE (lower(vl.city) = lower($1))'
		);
		// The filter's own parameters come first; the org, bucket and range follow them.
		expect(params).toEqual(['Austin', ORG, BUCKET, null]);
		expect(flat(sql)).toContain('tl.org_id = $2');
		expect(flat(sql)).toContain('l.bucket = $3::uuid');
	});

	it('scopes to every location when the bucket includes locations with no conditions', async () => {
		await getDashboardProgress(client as never, ORG, {
			id: BUCKET,
			filters: filters({ operator: 'AND', filters: [] })
		});

		const [sql, params] = client.query.mock.calls[0];
		expect(flat(sql)).toContain('SELECT vl.entity_id FROM universe.v_locations vl)');
		expect(params).toEqual([ORG, BUCKET, null]);
	});

	it('reports nothing, without querying, for a bucket that does not include locations', async () => {
		const progress = await getDashboardProgress(client as never, ORG, {
			id: BUCKET,
			filters: filters(null)
		});

		expect(progress).toEqual({
			total: 0,
			visited: 0,
			conversations: 0,
			visits: 0,
			answeredVisits: 0,
			recentConversations: 0
		});
		expect(client.query).not.toHaveBeenCalled();
	});

	it('passes the range as an interval', async () => {
		await getDashboardProgress(client as never, ORG, null, '7d');

		expect(client.query.mock.calls[0][1][2]).toBe('7 days');
	});
});

describe('getDashboardPoints', () => {
	it('selects the columns the map needs from the bucket scope', async () => {
		await getDashboardPoints(client as never, ORG, { id: BUCKET, filters: filters(austin) });

		const [sql, params] = client.query.mock.calls[0];
		expect(flat(sql)).toContain(
			'SELECT vl.entity_id, vl.name, vl.address_line_1, vl.city, vl.coordinates FROM universe.v_locations vl'
		);
		// The row limit is the last parameter, after the filter's and the scope's.
		expect(params).toEqual(['Austin', ORG, BUCKET, null, 5000]);
		expect(flat(sql)).toContain('LIMIT $5');
	});

	it('returns no points for a bucket that does not include locations', async () => {
		expect(await getDashboardPoints(client as never, ORG, { id: BUCKET, filters: filters(null) })).toEqual([]);
		expect(client.query).not.toHaveBeenCalled();
	});
});
