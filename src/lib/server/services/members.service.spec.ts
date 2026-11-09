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

const { platformRemoveMember, recordEvent } = vi.hoisted(() => ({
	platformRemoveMember: vi.fn(async () => undefined),
	recordEvent: vi.fn(async () => undefined)
}));
vi.mock('$lib/server/services/platform-organizations.service', () => ({
	removeMember: platformRemoveMember
}));
vi.mock('$lib/server/services/activity.service', () => ({ recordEvent }));

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
					? {
							rowCount: 1,
							rows: [
								{
									organization_id: ORG,
									role: 'member',
									suspended: status === 'suspended',
									deleted: status === 'deleted'
								}
							]
						}
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
		if (sql.includes('COUNT(*)'))
			return Promise.resolve({ rowCount: 1, rows: [{ count: String(total) }] });
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

import {
	listMembers,
	getMemberDetail,
	setMemberRole,
	setMemberPermission,
	removeMember
} from './members.service';

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	canInfra.mockResolvedValue(false);
	stub(250);
});

describe('listMembers', () => {
	it('returns the page with the total', async () => {
		expect(await listMembers('u1', ORG, 2)).toEqual({
			items: rows,
			totalCount: 250,
			page: 2,
			pageSize: 100
		});
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

// ---------------------------------------------------------------------------
// Changing one member
// ---------------------------------------------------------------------------

const MEMBER = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ROLE = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PERMISSION = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';

/**
 * Answers the member lookup (requireMemberOrg) with a member of ORG, the
 * caller's own membership, and everything else with `rest`.
 */
function stubMember(
	rest: (sql: string, values?: unknown[]) => unknown = () => ({ rowCount: 1, rows: [] }),
	member: { user_id: string; role: string } | null = { user_id: 'u2', role: 'member' }
) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('JOIN auth.member caller')) {
			return Promise.resolve(
				member
					? { rowCount: 1, rows: [{ organization_id: ORG, ...member }] }
					: { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('JOIN auth.organization o ON o.id = m.organization_id')) {
			return Promise.resolve({
				rowCount: 1,
				rows: [{ organization_id: ORG, role: 'member', suspended: false, deleted: false }]
			});
		}
		return Promise.resolve(rest(sql, values));
	});
}

function ran(fragment: string) {
	return mockClient.query.mock.calls.some((c) => String(c[0]).includes(fragment));
}

describe('getMemberDetail', () => {
	it('answers 403 without member.read', async () => {
		canOrg.mockResolvedValue(false);

		await expect(getMemberDetail('u1', ORG, 'u2')).rejects.toMatchObject({ status: 403 });
	});

	it('answers 404 for someone who is not a member', async () => {
		stub(0, () => ({ rowCount: 0, rows: [] }));

		await expect(getMemberDetail('u1', ORG, 'u9')).rejects.toMatchObject({ status: 404 });
	});

	it("lists every registered organization permission with the member's override", async () => {
		stub(0, (sql) => {
			if (sql.includes('FROM auth.member m')) {
				return { rowCount: 1, rows: [{ member_id: MEMBER, id: 'u2', name: 'Bo', email: 'b@x' }] };
			}
			if (sql.includes('FROM user_permission')) {
				return { rowCount: 1, rows: [{ registered_permission_id: 'p-access', value: false }] };
			}
			if (sql.includes('FROM registered_permission')) {
				return {
					rowCount: 2,
					rows: [
						{ id: 'p-access', key: 'system.access' },
						{ id: 'p-canvass', key: 'canvass.use' }
					]
				};
			}
			return { rowCount: 0, rows: [] };
		});

		const detail = await getMemberDetail('u1', ORG, 'u2');

		expect(detail.member_id).toBe(MEMBER);
		expect(detail.user).toEqual({ id: 'u2', name: 'Bo', email: 'b@x' });
		expect(detail.permissions.find((p) => p.key === 'system.access')).toMatchObject({
			id: 'p-access',
			value: false
		});
		expect(detail.permissions.find((p) => p.key === 'canvass.use')).toMatchObject({ value: null });
	});
});

describe('setMemberRole', () => {
	it("answers 404 for a member outside the caller's orgs and changes nothing", async () => {
		stubMember(undefined, null);

		await expect(setMemberRole('u1', MEMBER, ROLE)).rejects.toMatchObject({ status: 404 });
		expect(ran('user_role_membership')).toBe(false);
	});

	it('answers 403 without member.update and changes nothing', async () => {
		stubMember();
		canOrg.mockResolvedValue(false);

		await expect(setMemberRole('u1', MEMBER, ROLE)).rejects.toMatchObject({ status: 403 });
		expect(ran('DELETE FROM user_role_membership')).toBe(false);
	});

	it("answers 400 for a role that is not one of the org's", async () => {
		stubMember((sql) =>
			sql.includes('FROM permission_role') ? { rowCount: 0, rows: [] } : { rowCount: 0, rows: [] }
		);

		await expect(setMemberRole('u1', MEMBER, ROLE)).rejects.toMatchObject({ status: 400 });
		expect(ran('DELETE FROM user_role_membership')).toBe(false);
	});

	it('refuses to demote the last administrator', async () => {
		stubMember((sql) => {
			if (sql.includes('SELECT weight FROM permission_role'))
				return { rowCount: 1, rows: [{ weight: 500 }] };
			if (sql.includes('pr.weight = 0')) return { rowCount: 1, rows: [{ member_id: MEMBER }] };
			return { rowCount: 0, rows: [] };
		});

		await expect(setMemberRole('u1', MEMBER, ROLE)).rejects.toMatchObject({ status: 400 });
		expect(ran('DELETE FROM user_role_membership')).toBe(false);
	});

	it('demotes an administrator while another remains', async () => {
		stubMember((sql) => {
			if (sql.includes('pr.weight = 0'))
				return { rowCount: 2, rows: [{ member_id: MEMBER }, { member_id: 'other' }] };
			return { rowCount: 0, rows: [] };
		});

		await setMemberRole('u1', MEMBER, null);

		expect(ran('DELETE FROM user_role_membership')).toBe(true);
		expect(ran('INSERT INTO user_role_membership')).toBe(false);
	});

	it("swaps the member's organization roles for the new one", async () => {
		stubMember((sql) =>
			sql.includes('SELECT weight FROM permission_role')
				? { rowCount: 1, rows: [{ weight: 500 }] }
				: { rowCount: 0, rows: [] }
		);

		await setMemberRole('u1', MEMBER, ROLE);

		const insert = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('INSERT INTO user_role_membership')
		)!;
		expect(insert[1]).toEqual(['u2', MEMBER, ROLE, 'u1']);
	});
});

describe('setMemberPermission', () => {
	it('answers 403 without member.update and changes nothing', async () => {
		stubMember();
		canOrg.mockResolvedValue(false);

		await expect(setMemberPermission('u1', MEMBER, PERMISSION, true)).rejects.toMatchObject({
			status: 403
		});
		expect(ran('user_permission')).toBe(false);
	});

	it('answers 400 for a permission that is not an organization permission', async () => {
		stubMember(() => ({ rowCount: 0, rows: [] }));

		await expect(setMemberPermission('u1', MEMBER, PERMISSION, true)).rejects.toMatchObject({
			status: 400
		});
		expect(ran('INSERT INTO user_permission')).toBe(false);
	});

	it('saves an override within the org', async () => {
		stubMember();

		await setMemberPermission('u1', MEMBER, PERMISSION, false);

		const insert = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('INSERT INTO user_permission')
		)!;
		expect(insert[1]).toEqual(['u2', MEMBER, PERMISSION, ORG, false, 'u1']);
	});

	it('drops the override for null', async () => {
		stubMember();

		await setMemberPermission('u1', MEMBER, PERMISSION, null);

		const del = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('DELETE FROM user_permission')
		)!;
		expect(del[1]).toEqual([MEMBER, PERMISSION, ORG]);
	});
});

describe('removeMember', () => {
	it('hands an infra admin with orgs.manage to the audited platform removal', async () => {
		canInfra.mockResolvedValue(true);

		await removeMember('u1', MEMBER);

		expect(platformRemoveMember).toHaveBeenCalledWith('u1', MEMBER);
		expect(ran('DELETE FROM auth.member')).toBe(false);
	});

	it('refuses to let staff remove themselves', async () => {
		stubMember(undefined, { user_id: 'u1', role: 'member' });

		await expect(removeMember('u1', MEMBER)).rejects.toMatchObject({ status: 400 });
		expect(ran('DELETE FROM auth.member')).toBe(false);
	});

	it('answers 403 without member.delete', async () => {
		stubMember();
		canOrg.mockResolvedValue(false);

		await expect(removeMember('u1', MEMBER)).rejects.toMatchObject({ status: 403 });
		expect(ran('DELETE FROM auth.member')).toBe(false);
	});

	it('refuses to remove the only owner', async () => {
		stubMember(
			(sql) =>
				sql.includes('FOR UPDATE')
					? { rowCount: 1, rows: [{ id: MEMBER }] }
					: { rowCount: 0, rows: [] },
			{
				user_id: 'u2',
				role: 'owner'
			}
		);

		await expect(removeMember('u1', MEMBER)).rejects.toMatchObject({ status: 409 });
		expect(ran('DELETE FROM auth.member')).toBe(false);
	});

	it('removes the membership and its roles, and records that they left', async () => {
		stubMember();

		await removeMember('u1', MEMBER);

		expect(ran('DELETE FROM user_role_membership WHERE member_id')).toBe(true);
		expect(ran('DELETE FROM auth.member WHERE id')).toBe(true);
		expect(recordEvent).toHaveBeenCalledWith('member.left', {
			userId: 'u2',
			orgId: ORG,
			metadata: { removedBy: 'u1' }
		});
	});
});
