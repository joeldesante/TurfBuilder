import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } }));

const m = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn(),
	canInfra: vi.fn(),
	timeSeries: vi.fn(),
	rollingActiveUsers: vi.fn(),
	countBefore: vi.fn(),
	earliest: vi.fn(),
	queryAuditPage: vi.fn(),
	emailLogTotals: vi.fn()
}));

vi.mock('$lib/server/database', () => ({ POOL: m.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: m.requireInfraPermission, canInfra: m.canInfra }));
vi.mock('$lib/server/mail', () => ({ isMailConfigured: vi.fn(async () => true) }));
vi.mock('$lib/server/storage', () => ({ isStorageConfigured: vi.fn(async () => false) }));
vi.mock('./time-series.service', () => ({
	timeSeries: m.timeSeries,
	rollingActiveUsers: m.rollingActiveUsers,
	countBefore: m.countBefore,
	earliest: m.earliest
}));
vi.mock('./audit.service', () => ({ queryAuditPage: m.queryAuditPage }));
vi.mock('./email-log.service', () => ({ emailLogTotals: m.emailLogTotals }));
vi.mock('./migrations.service', () => ({ isMigrationNeeded: vi.fn(async () => true) }));
vi.mock('./system-settings.service', () => ({ getExternalLinks: vi.fn(async () => [{ label: 'Analytics', url: 'https://a' }]) }));

import { getPlatformMetric, getPlatformMetrics, getPlatformOverview, resolveWindow } from './platform-metrics.service';

const now = new Date('2026-10-20T12:00:00Z');
const points = [
	{ date: '2026-10-19', value: 2 },
	{ date: '2026-10-20', value: 3 }
];

beforeEach(() => {
	vi.clearAllMocks();
	m.requireInfraPermission.mockResolvedValue(undefined);
	m.canInfra.mockResolvedValue(true);
	m.timeSeries.mockResolvedValue(points);
	m.rollingActiveUsers.mockResolvedValue(points);
	m.countBefore.mockResolvedValue(100);
	m.earliest.mockResolvedValue(new Date('2020-01-01T00:00:00Z'));
	m.queryAuditPage.mockResolvedValue({ items: [{ id: '1' }] });
	m.emailLogTotals.mockResolvedValue({ sent: 9, skipped: 0, failed: 1 });
	m.pool.query.mockResolvedValue({ rows: [] });
});

describe('resolveWindow', () => {
	it('starts at the range start', async () => {
		const w = await resolveWindow('7d', 'day', now);
		expect(w.from.toISOString()).toBe('2026-10-14T00:00:00.000Z');
		expect(w.granularity).toBe('day');
	});

	it('starts all time at the first account and buckets it coarsely', async () => {
		const w = await resolveWindow('all', 'day', now);
		expect(w.from.toISOString()).toBe('2020-01-01T00:00:00.000Z');
		expect(w.granularity).toBe('month');
	});
});

describe('metrics', () => {
	it('every one requires access', async () => {
		await getPlatformMetric('u1', 'signups', '30d', 'day');
		expect(m.requireInfraPermission).toHaveBeenCalledWith('u1', 'access');
	});

	it('total accounts runs on from the count before the range', async () => {
		const { metric } = await getPlatformMetric('u1', 'total_users', '30d', 'day');
		expect(metric.kind === 'series' && metric.series[0].points.map((p) => p.value)).toEqual([102, 105]);
	});

	it('stickiness is daily over monthly active', async () => {
		m.rollingActiveUsers.mockImplementation(async (_db: unknown, { windowDays }: { windowDays: number }) =>
			points.map((p) => ({ ...p, value: windowDays === 1 ? 1 : 4 }))
		);
		const { metric } = await getPlatformMetric('u1', 'stickiness', '30d', 'day');
		expect(metric.kind === 'series' && metric.series[0].points.map((p) => p.value)).toEqual([0.25, 0.25]);
	});

	it('visits split by whether someone answered', async () => {
		await getPlatformMetric('u1', 'visits', '30d', 'day');
		const filters = m.timeSeries.mock.calls.map((c) => c[1].where);
		expect(filters).toEqual([
			{ type: 'canvass.visit', contactMade: 'true' },
			{ type: 'canvass.visit', contactMade: 'false' }
		]);
	});

	it('the whole page returns every metric', async () => {
		m.pool.query.mockImplementation((sql: string) =>
			Promise.resolve(
				sql.includes('provider_id')
					? { rows: [{ provider_id: 'credential', n: '5' }] }
					: sql.includes('two_factor_enabled') || sql.includes('email_verified')
						? { rows: [{ on: '1', off: '2', yes: '3', no: '4' }] }
						: { rows: [] }
			)
		);
		const all = await getPlatformMetrics('u1', '30d', 'day');
		expect(Object.keys(all)).toContain('retention');
		expect(all.window.range).toBe('30d');
	});
});

describe('getPlatformOverview', () => {
	beforeEach(() => {
		m.pool.query.mockImplementation((sql: string) =>
			Promise.resolve(
				sql.includes('AS new_users')
					? {
							rows: [
								{ users: '50', new_users: '6', new_users_before: '4', orgs: '7', active_orgs: '5', visits: '30', visits_before: '20', failed_documents: '2' }
							]
						}
					: { rows: [] }
			)
		);
	});

	it('gathers the headline figures and what needs attention', async () => {
		const overview = await getPlatformOverview('u1');

		expect(overview).toMatchObject({
			users: 50,
			newUsers7d: { value: 6, previous: 4 },
			activeUsers: { daily: 3, weekly: 3, monthly: 3 },
			organizations: 7,
			activeOrgs30d: 5,
			emails7d: { sent: 9, failed: 1 },
			status: { mailConfigured: true, storageConfigured: false, migrationNeeded: true, failedEmails24h: 1, failedDocuments24h: 2 }
		});
		expect(overview.externalLinks).toHaveLength(1);
	});

	it('leaves out the audit log for admins who cannot read it', async () => {
		m.canInfra.mockResolvedValue(false);
		expect((await getPlatformOverview('u1')).recentAudit).toBeNull();
		expect(m.queryAuditPage).not.toHaveBeenCalled();
	});
});
