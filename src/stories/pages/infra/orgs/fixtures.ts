import type {
	OrgInvitation,
	OrgInviteLink,
	OrgMember,
	PlatformOrgDetail,
	PlatformOrgRow
} from '$lib/shared/types/platform-organizations';

/** Sample data for the infra organization page stories and specs. */
export const orgRows: PlatformOrgRow[] = [
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567811',
		name: 'Riverside Canvass',
		slug: 'riverside',
		createdAt: '2026-02-01T10:00:00.000Z',
		memberCount: 128,
		pendingInvitations: 3,
		owner: { id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567801', name: 'Grace Hopper' },
		lastActiveDay: '2026-10-19',
		events30d: 2140,
		suspended: false,
		deleted: false
	},
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567812',
		name: 'Old Town Tenants',
		slug: 'old-town',
		createdAt: '2025-11-20T10:00:00.000Z',
		memberCount: 4,
		pendingInvitations: 0,
		owner: null,
		lastActiveDay: '2026-03-02',
		events30d: 0,
		suspended: true,
		deleted: false
	}
];

export const orgDetail: PlatformOrgDetail = {
	...orgRows[0],
	suspendedAt: null,
	suspendedReason: null,
	deletedAt: null,
	leaders: [
		{ userId: orgRows[0].owner!.id, name: 'Grace Hopper', email: 'grace@example.com', owner: true, roleName: 'Administrator' },
		{ userId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567803', name: 'Ada Lovelace', email: 'ada@example.com', owner: false, roleName: 'Administrator' }
	],
	createdBy: { id: orgRows[0].owner!.id, name: 'Grace Hopper' },
	plugins: [{ slug: 'rapid-response-alert-feed', enabled: true, installedAt: '2026-05-01T10:00:00.000Z' }],
	counts: {
		members: 128,
		activeMembers30d: 41,
		records: 18_420,
		buckets: 4,
		lists: 12,
		turfs: 86,
		surveys: 3,
		visits: 9_310,
		visits30d: 1_204,
		conversations: 3_877,
		documents: 9
	},
	memberActivity: { active: 41, dormant: 70, never: 17 }
};

export const members: OrgMember[] = [
	{
		memberId: 'b1b2c3d4-e5f6-4890-abcd-ef1234567801',
		userId: orgRows[0].owner!.id,
		name: 'Grace Hopper',
		email: 'grace@example.com',
		memberRole: 'owner',
		roleName: 'Administrator',
		joinedAt: '2026-02-01T10:00:00.000Z',
		lastActiveDay: '2026-10-19'
	},
	{
		memberId: 'b1b2c3d4-e5f6-4890-abcd-ef1234567802',
		userId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567804',
		name: 'Katherine Johnson',
		email: 'katherine@example.com',
		memberRole: 'member',
		roleName: null,
		joinedAt: '2026-04-10T10:00:00.000Z',
		lastActiveDay: null
	}
];

export const invitations: OrgInvitation[] = [
	{
		id: 'c1b2c3d4-e5f6-4890-abcd-ef1234567801',
		email: 'new.volunteer@example.com',
		role: 'member',
		status: 'pending',
		inviterName: 'Grace Hopper',
		createdAt: '2026-10-15T10:00:00.000Z'
	}
];

export const inviteLinks: OrgInviteLink[] = [
	{ id: 'Xk29dLq0', createdBy: 'Grace Hopper', createdAt: '2026-10-01T10:00:00.000Z', expiresAt: null }
];

export function pageOf<T>(items: T[], pageSize = 100) {
	return { items, totalCount: items.length, page: 1, pageSize };
}
