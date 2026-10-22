import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: {} as Record<string, string>,
	pool: { query: vi.fn(), totalCount: 4, idleCount: 3, waitingCount: 0 },
	requireInfraPermission: vi.fn(),
	isMailConfigured: vi.fn(),
	isStorageConfigured: vi.fn(),
	isMigrationNeeded: vi.fn(),
	emailLogTotals: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/database', () => ({ POOL: mocks.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: mocks.requireInfraPermission }));
vi.mock('$lib/server/mail', () => ({ isMailConfigured: mocks.isMailConfigured }));
vi.mock('$lib/server/storage', () => ({ isStorageConfigured: mocks.isStorageConfigured }));
vi.mock('./migrations.service', () => ({ isMigrationNeeded: mocks.isMigrationNeeded }));
vi.mock('./email-log.service', () => ({ emailLogTotals: mocks.emailLogTotals }));

import { getSystemHealth } from './system-health.service';

const ADMIN = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
	vi.clearAllMocks();
	delete mocks.env.GIT_SHA;
	delete mocks.env.PUPPETEER_EXECUTABLE_PATH;
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	mocks.isMailConfigured.mockResolvedValue(true);
	mocks.isStorageConfigured.mockResolvedValue(true);
	mocks.isMigrationNeeded.mockResolvedValue(false);
	mocks.emailLogTotals.mockResolvedValue({ sent: 5, skipped: 0, failed: 1 });
	mocks.pool.query.mockImplementation(async (sql: string) => {
		// postgis_version() also contains "version()", so it is matched first.
		if (sql.includes('postgis_version')) return { rows: [{ v: '3.4 USE_GEOS=1 USE_PROJ=1' }] };
		if (sql.includes('version()')) return { rows: [{ v: 'PostgreSQL 16.2 (Debian 16.2-1) on x86_64-pc-linux-gnu' }] };
		if (sql.includes('pg_database_size')) return { rows: [{ bytes: '1073741824' }] };
		if (sql.includes('pg_class')) return { rows: [{ name: 'universe.org_entity', bytes: '52428800', rows: '120000' }] };
		return { rows: [{ n: '2' }] };
	});
});

describe('getSystemHealth', () => {
	it('needs access and reads nothing without it', async () => {
		mocks.requireInfraPermission.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));

		await expect(getSystemHealth(ADMIN)).rejects.toMatchObject({ status: 403 });
		expect(mocks.requireInfraPermission).toHaveBeenCalledWith(ADMIN, 'access');
		expect(mocks.pool.query).not.toHaveBeenCalled();
	});

	it('reports the database, trimmed to what an admin reads', async () => {
		const { database } = await getSystemHealth(ADMIN);

		expect(database.postgresVersion).toBe('16.2');
		expect(database.postgisVersion).toBe('3.4');
		expect(database.sizeBytes).toBe(1073741824);
		expect(database.largestTables).toEqual([{ name: 'universe.org_entity', sizeBytes: 52428800, estimatedRows: 120000 }]);
		expect(database.pool).toEqual({ total: 4, idle: 3, waiting: 0 });
	});

	it('limits the table list so it stays small on a large database', async () => {
		await getSystemHealth(ADMIN);

		const sql = mocks.pool.query.mock.calls.map((c) => String(c[0])).find((s) => s.includes('pg_class'))!;
		expect(sql).toContain('LIMIT 15');
	});

	it('reports what is set up and what failed lately', async () => {
		mocks.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
		mocks.isStorageConfigured.mockResolvedValue(false);

		const { status } = await getSystemHealth(ADMIN);

		expect(status).toEqual({
			migrationNeeded: false,
			mailConfigured: true,
			storageConfigured: false,
			chromiumPathSet: true,
			emails24h: { sent: 5, skipped: 0, failed: 1 },
			failedDocuments24h: 2
		});
	});

	it('still answers when PostGIS is missing', async () => {
		mocks.pool.query.mockImplementation(async (sql: string) => {
			if (sql.includes('postgis_version')) throw new Error('function postgis_version() does not exist');
			if (sql.includes('version()')) return { rows: [{ v: 'PostgreSQL 16.2' }] };
			if (sql.includes('pg_database_size')) return { rows: [{ bytes: '1' }] };
			if (sql.includes('pg_class')) return { rows: [] };
			return { rows: [{ n: '0' }] };
		});

		expect((await getSystemHealth(ADMIN)).database.postgisVersion).toBeNull();
	});

	it('treats a failed migration check as needing one', async () => {
		mocks.isMigrationNeeded.mockRejectedValue(new Error('table missing'));

		expect((await getSystemHealth(ADMIN)).status.migrationNeeded).toBe(true);
	});

	it('shows the commit only when the deploy sets one', async () => {
		expect((await getSystemHealth(ADMIN)).runtime.gitSha).toBeNull();

		mocks.env.GIT_SHA = 'abc1234';
		expect((await getSystemHealth(ADMIN)).runtime.gitSha).toBe('abc1234');
	});
});
