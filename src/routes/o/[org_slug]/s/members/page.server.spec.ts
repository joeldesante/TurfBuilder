import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	listMembers: vi.fn(),
	listRoleOptions: vi.fn(),
	listInviteLinks: vi.fn()
}));
vi.mock('$lib/server/services/members.service', () => ({ listMembers: svc.listMembers }));
vi.mock('$lib/server/services/roles.service', () => ({ listRoleOptions: svc.listRoleOptions }));
vi.mock('$lib/server/services/invite-links.service', () => ({
	listInviteLinks: svc.listInviteLinks
}));

import { load } from './+page.server';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const ownerLocals = {
	user: { id: 'u1' },
	organization: {
		id: ORG_ID,
		permissions: ['member.read', 'member.delete', 'member.update', 'member.invite']
	}
};

const staffLocals = {
	user: { id: 'u2' },
	organization: { id: ORG_ID, permissions: ['member.read'] }
};

const noPermLocals = {
	user: { id: 'u3' },
	organization: { id: ORG_ID, permissions: [] }
};

function event(locals: unknown, page?: string) {
	const url = new URL('https://x/o/acme/s/members');
	if (page !== undefined) url.searchParams.set('page', page);
	return { locals, url } as unknown as Parameters<typeof load>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	svc.listMembers.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 });
	svc.listRoleOptions.mockResolvedValue([]);
	svc.listInviteLinks.mockResolvedValue({ links: [{ id: 'l1' }], slugInviteEnabled: true });
});

describe('members page load', () => {
	it('throws 403 without member.read and reads nothing', async () => {
		await expect(load(event(noPermLocals))).rejects.toMatchObject({ status: 403 });
		expect(svc.listMembers).not.toHaveBeenCalled();
	});

	it('returns the page of members, the roles, and the paging', async () => {
		const members = [{ id: 'u1', name: 'Alice', member_id: 'm1' }];
		svc.listMembers.mockResolvedValue({ items: members, totalCount: 250, page: 3, pageSize: 100 });
		svc.listRoleOptions.mockResolvedValue([{ id: 'r1', name: 'Admin' }]);

		const result = await load(event(staffLocals, '3'));

		expect(svc.listMembers).toHaveBeenCalledWith('u2', ORG_ID, 3);
		expect(result).toMatchObject({
			members,
			totalCount: 250,
			page: 3,
			pageSize: 100,
			roles: [{ id: 'r1', name: 'Admin' }]
		});
	});

	it('leaves invite links out for someone who cannot invite', async () => {
		const result = await load(event(staffLocals));

		expect(svc.listInviteLinks).not.toHaveBeenCalled();
		expect(result).toMatchObject({ canInvite: false, inviteLinks: [], slugInviteEnabled: false });
	});

	it('loads invite links for someone who can invite', async () => {
		const result = await load(event(ownerLocals));

		expect(svc.listInviteLinks).toHaveBeenCalledWith('u1', ORG_ID);
		expect(result).toMatchObject({
			canInvite: true,
			inviteLinks: [{ id: 'l1' }],
			slugInviteEnabled: true
		});
	});

	it('reports what the caller may change', async () => {
		expect(await load(event(staffLocals))).toMatchObject({
			canRemoveMembers: false,
			canManageRoles: false
		});
		expect(await load(event(ownerLocals))).toMatchObject({
			canRemoveMembers: true,
			canManageRoles: true
		});
	});
});
