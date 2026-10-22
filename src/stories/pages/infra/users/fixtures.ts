import type {
	PlatformUserDetail,
	PlatformUserRow,
	UserMembership,
	UserSession
} from '$lib/shared/types/platform-users';
import type { ActivityEntry, EmailLogEntry } from '$lib/shared/types/activity';
import type { AuditEntry } from '$lib/shared/types/audit';

/** Sample data for the infra user page stories and specs. */
export const userRows: PlatformUserRow[] = [
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567801',
		name: 'Grace Hopper',
		email: 'grace@example.com',
		username: 'grace',
		image: null,
		emailVerified: true,
		twoFactorEnabled: true,
		suspended: false,
		createdAt: '2026-01-04T10:00:00.000Z',
		lastActiveDay: '2026-10-19',
		orgCount: 2,
		isInfraAdmin: true
	},
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567802',
		name: 'Alan Turing',
		email: 'alan@example.com',
		username: 'alan',
		image: null,
		emailVerified: false,
		twoFactorEnabled: false,
		suspended: true,
		createdAt: '2026-06-12T10:00:00.000Z',
		lastActiveDay: null,
		orgCount: 0,
		isInfraAdmin: false
	}
];

export const userDetail: PlatformUserDetail = {
	...userRows[1],
	suspended: false,
	displayUsername: 'Alan',
	updatedAt: '2026-09-01T10:00:00.000Z',
	suspendedReason: null,
	suspendedUntil: null,
	signInMethods: [{ providerId: 'credential', createdAt: '2026-06-12T10:00:00.000Z' }],
	infraRoles: [],
	activeSessionCount: 2,
	deleted: false
};

export const memberships: UserMembership[] = [
	{
		memberId: 'm1',
		organizationId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567811',
		name: 'Riverside Canvass',
		slug: 'riverside',
		memberRole: 'owner',
		roleName: 'Administrator',
		joinedAt: '2026-06-12T10:00:00.000Z',
		lastActiveDay: '2026-10-18',
		suspended: false,
		deleted: false
	}
];

export const sessions: UserSession[] = [
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567821',
		ipAddress: '203.0.113.9',
		userAgent:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
		createdAt: '2026-10-18T10:00:00.000Z',
		updatedAt: '2026-10-19T10:00:00.000Z',
		expiresAt: '2026-10-25T10:00:00.000Z',
		impersonatedBy: null
	}
];

export const activity: ActivityEntry[] = [
	{
		id: '1',
		type: 'canvass.visit',
		label: 'Visited a location',
		userId: userDetail.id,
		userName: userDetail.name,
		orgId: memberships[0].organizationId,
		orgName: 'Riverside Canvass',
		metadata: { contact_made: true },
		occurredAt: '2026-10-18T15:00:00.000Z'
	}
];

export const emails: EmailLogEntry[] = [
	{
		id: '9',
		recipient: 'alan@example.com',
		template: 'auth.reset_password',
		subject: 'Reset your password',
		status: 'sent',
		error: null,
		createdAt: '2026-10-10T09:00:00.000Z'
	}
];

export const auditEntries: AuditEntry[] = [
	{
		id: '3',
		actorId: userRows[0].id,
		actorName: 'Grace Hopper',
		actorEmail: 'grace@example.com',
		action: 'user.password_reset.send',
		targetType: 'user',
		targetId: userDetail.id,
		metadata: {},
		ip: '203.0.113.1',
		userAgent: null,
		createdAt: '2026-10-10T09:00:00.000Z'
	}
];

export function pageOf<T>(items: T[], pageSize = 25) {
	return { items, totalCount: items.length, page: 1, pageSize };
}
