import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { pool, orgClient } = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	orgClient: { query: vi.fn() }
}));

vi.mock('$lib/server/database', () => ({
	POOL: pool,
	withOrgTransaction: vi.fn(async (_orgId: string, fn: (client: unknown) => unknown) => fn(orgClient))
}));

import { recordEvent, touchActiveDay, backfillActivity, pruneActivity } from './activity.service';
import { logger } from '$lib/server/logger';

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

beforeEach(() => {
	vi.clearAllMocks();
	pool.query.mockResolvedValue({ rowCount: 1, rows: [] });
	orgClient.query.mockResolvedValue({ rowCount: 2, rows: [] });
});

describe('recordEvent', () => {
	it('inserts the event and skips one already recorded under the same source key', async () => {
		await recordEvent('user.signed_in', { userId: 'u1', orgId: 'o1', sourceKey: 'session:s1' });

		const [sql, params] = pool.query.mock.calls[0];
		expect(flat(sql)).toContain('INSERT INTO activity_event');
		expect(flat(sql)).toContain('ON CONFLICT (source_key) DO NOTHING');
		expect(params).toEqual(['user.signed_in', 'u1', 'o1', '{}', 'session:s1', null]);
	});

	it('never throws, so a lost event cannot fail the request', async () => {
		pool.query.mockRejectedValue(new Error('db down'));
		const log = vi.spyOn(logger, 'error').mockImplementation(() => {});

		await expect(recordEvent('list.created', { userId: 'u1' })).resolves.toBeUndefined();
		expect(log).toHaveBeenCalled();
		log.mockRestore();
	});
});

describe('touchActiveDay', () => {
	it('writes the platform row and the org row once per day', () => {
		touchActiveDay('user-a', 'org-a');
		touchActiveDay('user-a', 'org-a');

		expect(pool.query).toHaveBeenCalledTimes(1);
		const [, params] = pool.query.mock.calls[0];
		expect(params[1]).toBe('user-a');
		expect(params[2]).toEqual(['', 'org-a']);
	});

	it('writes only the row it has not written yet', () => {
		touchActiveDay('user-b');
		touchActiveDay('user-b', 'org-b');

		expect(pool.query).toHaveBeenCalledTimes(2);
		expect(pool.query.mock.calls[1][1][2]).toEqual(['org-b']);
	});
});

describe('backfillActivity', () => {
	beforeEach(() => {
		pool.query.mockImplementation((sql: string) => {
			if (sql.includes('system_setting')) return Promise.resolve({ rows: [{ value: '0' }] });
			if (sql.includes('SELECT id FROM auth.organization')) {
				return Promise.resolve({ rows: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }] });
			}
			return Promise.resolve({ rowCount: 3, rows: [] });
		});
	});

	it('uses the same source keys live events use, so reruns add nothing', async () => {
		await backfillActivity();

		const all = [...pool.query.mock.calls, ...orgClient.query.mock.calls].map((c) => flat(c[0])).join('\n');
		for (const key of ["'user.signed_up:'", "'session:'", "'org.created:'", "'member.joined:'", "'canvass.visit:'", "'survey.submitted:'"]) {
			expect(all).toContain(key);
		}
		expect(all.match(/ON CONFLICT \(source_key\) DO NOTHING/g)?.length).toBe(6);
	});

	it('skips impersonation sessions', async () => {
		await backfillActivity();

		const signIns = pool.query.mock.calls.find((c) => flat(c[0]).includes("'session:'"));
		expect(flat(signIns?.[0])).toContain('impersonated_by IS NULL');
	});

	it('reads canvassing one org at a time, inside that org', async () => {
		await backfillActivity();

		const visits = orgClient.query.mock.calls.find((c) => flat(c[0]).includes('canvass.visit'));
		expect(flat(visits?.[0])).toContain('WHERE a.org_id = $1');
		expect(visits?.[1]).toEqual(['a1b2c3d4-e5f6-7890-abcd-ef1234567890', null]);
	});

	it('copies nothing older than the retention window, so pruning does not remove it again', async () => {
		pool.query.mockImplementation((sql: string) => {
			if (sql.includes('system_setting')) return Promise.resolve({ rows: [{ value: '30' }] });
			if (sql.includes('SELECT id FROM auth.organization')) return Promise.resolve({ rows: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }] });
			return Promise.resolve({ rowCount: 0, rows: [] });
		});
		const before = Date.now();

		await backfillActivity();

		const inserts = [...pool.query.mock.calls, ...orgClient.query.mock.calls].filter((c) => flat(c[0]).startsWith('INSERT'));
		expect(inserts.length).toBe(8);
		for (const [sql, params] of inserts) {
			expect(flat(sql)).toMatch(/created_at >= \$\d/);
			const cutoff = (params as unknown[]).find((p) => p instanceof Date) as Date;
			expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
		}
	});

	it('reports what it added', async () => {
		const report = await backfillActivity();

		expect(report.inserted).toMatchObject({ 'user.signed_up': 3, 'canvass.visit': 2, 'survey.submitted': 2 });
		expect(report.activeDays).toBe(5);
	});
});

describe('pruneActivity', () => {
	it('removes events past the retention setting', async () => {
		pool.query.mockImplementation((sql: string) =>
			Promise.resolve(sql.includes('system_setting') ? { rows: [{ value: '30' }] } : { rowCount: 9, rows: [] })
		);

		const before = Date.now();
		expect(await pruneActivity()).toBe(9);
		const deletion = pool.query.mock.calls.find((c) => flat(c[0]).startsWith('DELETE FROM activity_event'));
		const cutoff = (deletion?.[1] as Date[])[0];
		expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
		// Active days and the email log go too, so neither grows without end.
		const sqls = pool.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls.some((q) => q.startsWith('DELETE FROM user_activity_day'))).toBe(true);
		expect(sqls.some((q) => q.startsWith('DELETE FROM email_log'))).toBe(true);
	});

	it('keeps everything when retention is 0', async () => {
		pool.query.mockResolvedValue({ rows: [{ value: '0' }] });

		expect(await pruneActivity()).toBe(0);
		expect(pool.query).toHaveBeenCalledTimes(1);
	});
});
