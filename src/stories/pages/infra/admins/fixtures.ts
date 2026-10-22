import type { InfraAdmin, InfraRole } from '$lib/shared/types/infra-admins';

export const roles: InfraRole[] = [
	{
		id: 'd1b2c3d4-e5f6-4890-abcd-ef1234567801',
		name: 'Infrastructure Administrator',
		weight: 1,
		permissions: ['access', 'audit.read', 'orgs.manage', 'settings.manage', 'users.impersonate', 'users.manage'],
		holderCount: 2
	},
	{ id: 'd1b2c3d4-e5f6-4890-abcd-ef1234567802', name: 'Support', weight: 2, permissions: ['access', 'audit.read'], holderCount: 1 }
];

export const admins: InfraAdmin[] = [
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567801',
		name: 'Grace Hopper',
		email: 'grace@example.org',
		roles: [{ id: roles[0].id, name: roles[0].name, grantedAt: '2026-01-05T10:00:00.000Z', grantedBy: null }],
		permissions: roles[0].permissions,
		canManageAdmins: true
	},
	{
		id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567802',
		name: 'Ada Lovelace',
		email: 'ada@example.org',
		roles: [{ id: roles[1].id, name: roles[1].name, grantedAt: '2026-06-12T10:00:00.000Z', grantedBy: 'Grace Hopper' }],
		permissions: roles[1].permissions,
		canManageAdmins: false
	}
];

export const candidates = [
	{ id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567803', name: 'Katherine Johnson', email: 'katherine@example.org' },
	{ id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567804', name: 'Katherine Ross', email: 'kross@example.org' }
];
