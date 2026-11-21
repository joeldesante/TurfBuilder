import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn(async () => undefined)
}));

vi.mock('$lib/server/database', () => ({ POOL: m.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: m.requireInfraPermission }));

import {
	emailLogTemplates,
	emailLogTotals,
	listEmailLog,
	queryEmailLogPage
} from './email-log.service';

const row = {
	id: 7,
	recipient: 'ada@example.org',
	template: 'auth.verify_email',
	subject: 'Verify',
	status: 'sent',
	error: null,
	created_at: new Date('2026-11-01T12:00:00Z')
};

beforeEach(() => {
	vi.clearAllMocks();
	m.pool.query.mockImplementation(async (sql: string) =>
		sql.includes('COUNT(*)') ? { rows: [{ count: '250' }] } : { rows: [row] }
	);
});

describe('queryEmailLogPage', () => {
	it('pages newest first and maps rows', async () => {
		const page = await queryEmailLogPage({}, 2);

		expect(page).toMatchObject({ totalCount: 250, page: 2, pageSize: 100 });
		expect(page.items[0]).toEqual({
			id: '7',
			recipient: 'ada@example.org',
			template: 'auth.verify_email',
			subject: 'Verify',
			status: 'sent',
			error: null,
			createdAt: '2026-11-01T12:00:00.000Z'
		});
		const [sql, values] = m.pool.query.mock.calls[1];
		expect(sql).toContain('ORDER BY created_at DESC, id DESC');
		expect(values).toEqual([100, 100]);
	});

	it('filters by status, template, and recipient (any case) as parameters', async () => {
		await queryEmailLogPage(
			{ status: 'failed', template: 'system.test', recipient: 'Ada@Example.org' },
			1
		);

		const [countSql, countValues] = m.pool.query.mock.calls[0];
		expect(countSql).toContain('WHERE status = $1 AND template = $2 AND lower(recipient) = $3');
		expect(countValues).toEqual(['failed', 'system.test', 'ada@example.org']);
	});

	it('clamps a page past the end', async () => {
		expect((await queryEmailLogPage({}, 99)).page).toBe(3);
	});
});

describe('access', () => {
	it.each([
		['listEmailLog', () => listEmailLog('u1', {}, 1)],
		['emailLogTemplates', () => emailLogTemplates('u1')]
	])('%s needs settings.manage and reads nothing without it', async (_name, run) => {
		m.requireInfraPermission.mockRejectedValueOnce(
			Object.assign(new Error('Forbidden'), { status: 403 })
		);

		await expect(run()).rejects.toMatchObject({ status: 403 });
		expect(m.requireInfraPermission).toHaveBeenCalledWith('u1', 'settings.manage');
		expect(m.pool.query).not.toHaveBeenCalled();
	});
});

describe('emailLogTotals', () => {
	it('counts each status over the period, with zero for those missing', async () => {
		m.pool.query.mockResolvedValue({
			rows: [
				{ status: 'sent', count: '12' },
				{ status: 'failed', count: '1' }
			]
		});

		expect(await emailLogTotals(30)).toEqual({ sent: 12, skipped: 0, failed: 1 });
		expect(m.pool.query.mock.calls[0][1]).toEqual([30]);
	});
});
