import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countBefore, earliest, rollingActiveUsers, timeSeries } from './time-series.service';

const db = { query: vi.fn() };
const from = new Date('2026-10-01T00:00:00Z');
const to = new Date('2026-10-03T12:00:00Z');

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

beforeEach(() => {
	db.query.mockReset();
	db.query.mockResolvedValue({
		rows: [
			{ date: '2026-10-01', value: '3' },
			{ date: '2026-10-02', value: '0' },
			{ date: '2026-10-03', value: '5' }
		]
	});
});

describe('timeSeries', () => {
	it('returns one zero-filled point per bucket', async () => {
		const points = await timeSeries(db as never, { source: 'users', from, to, granularity: 'day' });

		expect(points).toEqual([
			{ date: '2026-10-01', value: 3 },
			{ date: '2026-10-02', value: 0 },
			{ date: '2026-10-03', value: 5 }
		]);
		const [sql, params] = db.query.mock.calls[0];
		expect(flat(sql)).toContain('generate_series');
		expect(flat(sql)).toContain('FROM auth.user t');
		expect(params).toEqual(['day', from, to]);
	});

	it('scopes to an org and filters with parameters', async () => {
		await timeSeries(db as never, {
			source: 'activity_events',
			from,
			to,
			granularity: 'week',
			orgId: 'org-1',
			where: { type: "user.signed_in'; DROP TABLE x; --" }
		});

		const [sql, params] = db.query.mock.calls[0];
		expect(flat(sql)).toContain('t.org_id = $4 AND t.type = $5::text');
		expect(params[4]).toBe("user.signed_in'; DROP TABLE x; --");
	});

	it('compares a uuid column as a uuid, so its index applies', async () => {
		await timeSeries(db as never, { source: 'activity_events', from, to, granularity: 'week', where: { userId: 'u1' } });

		const sql = flat(db.query.mock.calls[0][0]);
		expect(sql).toContain('t.user_id = $4::uuid');
		expect(sql).not.toContain('user_id::text');
	});

	it('compares a boolean column as a boolean and a JSON field as text', async () => {
		await timeSeries(db as never, { source: 'canvass_visits', from, to, granularity: 'day', orgId: 'o', where: { contactMade: true } });
		expect(flat(db.query.mock.calls[0][0])).toContain('t.contact_made = $5::boolean');
		expect(db.query.mock.calls[0][1][4]).toBe(true);

		await timeSeries(db as never, { source: 'activity_events', from, to, granularity: 'day', where: { contactMade: true } });
		expect(flat(db.query.mock.calls[1][0])).toContain("(t.metadata->>'contact_made') = $4::text");
		expect(db.query.mock.calls[1][1][3]).toBe('true');
	});

	it('counts distinct values when asked', async () => {
		await timeSeries(db as never, { source: 'canvass_visits', from, to, granularity: 'day', orgId: 'o', distinct: 'users' });

		expect(flat(db.query.mock.calls[0][0])).toContain('COUNT(DISTINCT t.user_id)');
	});

	it('rejects filters, sources, and granularities outside the allow-list', async () => {
		await expect(
			timeSeries(db as never, { source: 'users', from, to, granularity: 'day', where: { nope: 'x' } as never })
		).rejects.toThrow('Cannot filter');
		await expect(timeSeries(db as never, { source: 'evil' as never, from, to, granularity: 'day' })).rejects.toThrow(
			'Unknown time series source'
		);
		await expect(timeSeries(db as never, { source: 'users', from, to, granularity: 'hour' as never })).rejects.toThrow(
			'Unknown granularity'
		);
		await expect(timeSeries(db as never, { source: 'users', from, to, granularity: 'day', orgId: 'o' })).rejects.toThrow(
			'cannot be scoped'
		);
		expect(db.query).not.toHaveBeenCalled();
	});
});

describe('helpers', () => {
	it('countBefore counts rows before a date, optionally in an org', async () => {
		db.query.mockResolvedValue({ rows: [{ n: '42' }] });
		expect(await countBefore(db as never, 'members', from, 'org-1')).toBe(42);
		expect(db.query.mock.calls[0][1]).toEqual([from, 'org-1']);
	});

	it('earliest is null for an empty source', async () => {
		db.query.mockResolvedValue({ rows: [{ first: null }] });
		expect(await earliest(db as never, 'users')).toBeNull();
	});

	it('rollingActiveUsers counts a trailing window per bucket', async () => {
		await rollingActiveUsers(db as never, { from, to, granularity: 'day', windowDays: 7, orgId: 'org-1' });

		const [sql, params] = db.query.mock.calls[0];
		expect(flat(sql)).toContain('d.day > b.last_day - $5::int AND d.day <= b.last_day');
		expect(params).toEqual(['day', from, to, 'org-1', 7]);
	});
});
