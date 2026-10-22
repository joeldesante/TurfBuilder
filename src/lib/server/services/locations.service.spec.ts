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

import { listOrgLocations } from './locations.service';

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub(250);
});

describe('listOrgLocations', () => {
	it('returns the page with the total', async () => {
		expect(await listOrgLocations('u1', ORG, 2)).toEqual({ items: rows, totalCount: 250, page: 2, pageSize: 100 });
	});

	it('checks location.read', async () => {
		await listOrgLocations('u1', ORG, 1);

		expect(canOrg).toHaveBeenCalledWith(expect.anything(), 'u1', ORG, 'location.read');
	});

	it('answers 403 without location.read and reads nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listOrgLocations('u1', ORG, 1)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('LIMIT $2 OFFSET $3')).toBeUndefined();
	});

	it('answers 404 for a non-member', async () => {
		stub(250, undefined, false);

		await expect(listOrgLocations('u1', ORG, 1)).rejects.toMatchObject({ status: 404 });
	});

	it('counts and pages within the org', async () => {
		await listOrgLocations('u1', ORG, 3);

		expect(flat(sqlRun('COUNT(*)')![0])).toContain('universe.org_location');
		expect(sqlRun('COUNT(*)')![1]).toEqual([ORG]);
		expect(sqlRun('LIMIT $2 OFFSET $3')![1]).toEqual([ORG, 100, 200]);
	});

	it('clamps a page past the end', async () => {
		expect((await listOrgLocations('u1', ORG, 99)).page).toBe(3);
	});

	it('orders with an id tiebreak, so pages cannot repeat or skip a row', async () => {
		await listOrgLocations('u1', ORG, 1);

		expect(flat(sqlRun('LIMIT $2 OFFSET $3')![0])).toContain('ORDER BY ol.name NULLS LAST, ol.address_line_1 NULLS LAST, ol.id LIMIT');
	});
});

describe('current versions only', () => {
	it('leaves superseded versions out of the count and the page', async () => {
		await listOrgLocations('u1', ORG, 1);

		expect(flat(sqlRun('COUNT(*)')![0])).toContain('valid_to IS NULL');
		expect(flat(sqlRun('LIMIT $2 OFFSET $3')![0])).toContain('valid_to IS NULL');
	});
});
