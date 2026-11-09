import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listRoles } = vi.hoisted(() => ({ listRoles: vi.fn() }));
vi.mock('$lib/server/services/roles.service', () => ({ listRoles }));

import { load } from './+page.server';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// can() reads the permissions hooks.server.ts resolved onto locals.organization.
const ownerLocals = {
	user: { id: 'u1' },
	organization: { id: ORG_ID, permissions: ['role.read'] }
};

const memberLocals = {
	user: { id: 'u2' },
	organization: { id: ORG_ID, permissions: [] }
};

beforeEach(() => {
	vi.clearAllMocks();
	listRoles.mockResolvedValue([]);
});

describe('settings/roles page load', () => {
	it('throws 403 without role.read and reads nothing', async () => {
		await expect(load({ locals: memberLocals } as never)).rejects.toMatchObject({ status: 403 });
		expect(listRoles).not.toHaveBeenCalled();
	});

	it("returns the organization's roles", async () => {
		const roles = [{ id: 'r1', name: 'Admin', is_default: false, weight: 0, permissions: [] }];
		listRoles.mockResolvedValue(roles);

		const result = await load({ locals: ownerLocals } as never);

		expect(result.roles).toEqual(roles);
		expect(listRoles).toHaveBeenCalledWith('u1', ORG_ID);
	});
});
