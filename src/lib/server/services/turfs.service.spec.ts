import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	client: { query: vi.fn() },
	requireActiveMembership: vi.fn(async () => ({ role: 'member' }))
}));

vi.mock('$lib/server/database', () => ({
	withOrgTransaction: async (_org: string, fn: (c: unknown) => unknown) => fn(m.client)
}));
vi.mock('$lib/server/list-access', () => ({ requireActiveMembership: m.requireActiveMembership }));

import { joinTurfByCode } from './turfs.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

beforeEach(() => {
	vi.clearAllMocks();
	m.client.query.mockImplementation(async (sql: string) =>
		sql.includes('FROM universe.turf')
			? { rowCount: 1, rows: [{ id: 't1' }] }
			: { rowCount: 1, rows: [] }
	);
});

describe('joinTurfByCode', () => {
	it('answers for non-members before reading any turf', async () => {
		m.requireActiveMembership.mockRejectedValueOnce(
			Object.assign(new Error('nope'), { status: 404 })
		);

		await expect(joinTurfByCode('u1', ORG, 'ABC123')).rejects.toMatchObject({ status: 404 });
		expect(m.client.query).not.toHaveBeenCalled();
	});

	it('answers 404 for a code no turf in the org has, and joins nothing', async () => {
		m.client.query.mockResolvedValue({ rowCount: 0, rows: [] });

		await expect(joinTurfByCode('u1', ORG, 'ABC123')).rejects.toMatchObject({ status: 404 });
		expect(m.client.query.mock.calls.some((c) => String(c[0]).includes('INSERT'))).toBe(false);
	});

	it('looks the code up in the org and joins the caller, ignoring a repeat', async () => {
		expect(await joinTurfByCode('u1', ORG, 'ABC123')).toEqual({ id: 't1' });

		expect(m.client.query.mock.calls[0][1]).toEqual(['ABC123', ORG]);
		const [sql, values] = m.client.query.mock.calls[1];
		expect(sql).toContain('ON CONFLICT DO NOTHING');
		expect(values).toEqual(['t1', 'u1', ORG]);
	});
});
