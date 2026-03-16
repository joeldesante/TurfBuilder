import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock('pg', () => ({
	Pool: vi.fn(() => ({
		connect: vi.fn().mockResolvedValue(mockClient),
		on: vi.fn(),
		end: vi.fn()
	}))
}));

import { load } from './+page.server';

const ownerLocals = {
	user: { id: 'u1' },
	organization: {
		id: 'org-1',
		role: { id: 'r1', is_owner: true, is_default: false, permissions: null }
	}
};

const staffLocals = {
	user: { id: 'u2' },
	organization: {
		id: 'org-1',
		role: { id: 'r2', is_owner: false, is_default: false, permissions: ['member:read'] }
	}
};

const noPermLocals = {
	user: { id: 'u3' },
	organization: {
		id: 'org-1',
		role: { id: 'r3', is_owner: false, is_default: false, permissions: [] }
	}
};

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.query.mockResolvedValue({ rows: [] });
});

describe('members page load', () => {
	it('throws 403 when caller lacks member:read', async () => {
		await expect(load({ locals: noPermLocals } as any)).rejects.toMatchObject({ status: 403 });
	});

	it('returns members array for authorized user', async () => {
		const members = [{ id: 'u1', name: 'Alice', email: 'a@b.com', role_id: null, role_name: null }];
		mockClient.query
			.mockResolvedValueOnce({ rows: members })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });

		const result = await load({ locals: staffLocals } as any);
		expect(result.members).toEqual(members);
	});

	it('includes canRemoveMembers based on permissions', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await load({ locals: staffLocals } as any);
		// staffLocals has member:read but not member:delete
		expect(result.canRemoveMembers).toBe(false);
	});

	it('sets isOwner=true for owner locals', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await load({ locals: ownerLocals } as any);
		expect(result.isOwner).toBe(true);
	});

	it('releases the db client', async () => {
		await load({ locals: staffLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
