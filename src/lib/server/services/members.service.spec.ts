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

const { canInfra } = vi.hoisted(() => ({ canInfra: vi.fn(async () => false) }));
vi.mock('$lib/server/permissions', () => ({ canOrg, canInfra }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const rows = [{ id: 'r1' }];

/**
 * Answers membership, the in-org lookups, the COUNT with `total`, and
 * everything else with `rest`. `member` false makes the caller a non-member.
 */
function stub(
	total: number,
	rest: (sql: string) => unknown = () => ({ rowCount: rows.length, rows }),
	member = true,
	status: 'active' | 'suspended' | 'deleted' = 'active'
) {
	mockClient.query.mockImplementation((sql: string) => {
		// Membership with the org's status (requireActiveMembership, findInMemberOrgs).
		if (sql.includes('JOIN auth.organization o ON o.id = m.organization_id')) {
			return Promise.resolve(
				member
					? { rowCount: 1, rows: [{ organization_id: ORG, role: 'member', suspended: status === 'suspended', deleted: status === 'deleted' }] }
					: { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('FROM auth.member WHERE user_id')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('SELECT organization_id FROM auth.member')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		if (sql.startsWith('SELECT 1 FROM')) return Promise.resolve({ rowCount: 1, rows: [{}] });
		if (sql.includes('COUNT(*)')) return Promise.resolve({ rowCount: 1, rows: [{ count: String(total) }] });
		return Promise.resolve(rest(sql));
	});
}

/** [sql, params] of the first query containing `fragment`. */
function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

import { listMembers } from './members.service';

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub(250);
});

describe('listMembers', () => {
	it('returns the page with the total', async () => {
		expect(await listMembers('u1', ORG, 2)).toEqual({ items: rows, totalCount: 250, page: 2, pageSize: 100 });
	});

	it('checks member.read', async () => {
		await listMembers('u1', ORG, 1);

		expect(canOrg).toHaveBeenCalledWith(expect.anything(), 'u1', ORG, 'member.read');
	});

	it('lets an infra admin read any organization without member.read', async () => {
		canInfra.mockResolvedValueOnce(true);
		canOrg.mockResolvedValue(false);

		expect(await listMembers('u1', ORG, 1)).toMatchObject({ totalCount: 250 });
		expect(canOrg).not.toHaveBeenCalled();
	});

	it('answers 403 without member.read and reads nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listMembers('u1', ORG, 1)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('LIMIT $3 OFFSET $4')).toBeUndefined();
	});

	it('answers 403 for a suspended org and reads nothing', async () => {
		stub(250, undefined, true, 'suspended');

		await expect(listMembers('u1', ORG, 1)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('LIMIT $3 OFFSET $4')).toBeUndefined();
	});

	it('answers 404 for a deleted org, as if it did not exist', async () => {
		stub(250, undefined, true, 'deleted');

		await expect(listMembers('u1', ORG, 1)).rejects.toMatchObject({ status: 404 });
	});

	it('answers 404 for a non-member', async () => {
		stub(250, undefined, false);

		await expect(listMembers('u1', ORG, 1)).rejects.toMatchObject({ status: 404 });
	});

	it('counts and pages within the org', async () => {
		await listMembers('u1', ORG, 3);

		expect(flat(sqlRun('COUNT(*)')![0])).toContain('WHERE m.organization_id = $1');
		expect(sqlRun('COUNT(*)')![1]).toEqual([ORG, null]);
		expect(sqlRun('LIMIT $3 OFFSET $4')![1]).toEqual([ORG, null, 100, 200]);
	});

	it('searches name and email, with LIKE wildcards escaped, in the count and the page alike', async () => {
		await listMembers('u1', ORG, 1, ' Ka_th% ');

		expect(sqlRun('COUNT(*)')![1]).toEqual([ORG, '%ka\\_th\\%%']);
		expect(sqlRun('LIMIT $3 OFFSET $4')![1]).toEqual([ORG, '%ka\\_th\\%%', 100, 0]);
		expect(flat(sqlRun('LIMIT $3 OFFSET $4')![0])).toContain('lower(u.email) LIKE $2');
	});

	it('clamps a page past the end', async () => {
		expect((await listMembers('u1', ORG, 99)).page).toBe(3);
	});

	it('orders with an id tiebreak, so pages cannot repeat or skip a row', async () => {
		await listMembers('u1', ORG, 1);

		expect(flat(sqlRun('LIMIT $3 OFFSET $4')![0])).toContain('ORDER BY lower(name), id LIMIT');
	});
});
