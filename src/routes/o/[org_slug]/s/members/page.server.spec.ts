import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factory, which vitest lifts above this file's consts,
// can still reach it.
const { mockClient } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() }
}));

vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			// members' load() also queries invite links directly via POOL.query.
			query: vi.fn().mockResolvedValue({ rows: [] }),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

import { load } from './+page.server';

const ownerLocals = {
	user: { id: 'u1' },
	organization: {
		id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		role: { id: 'r1', name: 'Owner' },
		permissions: ['member.read', 'member.delete', 'member.update', 'member.invite']
	}
};

const staffLocals = {
	user: { id: 'u2' },
	organization: {
		id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		role: { id: 'r2', name: 'Staff' },
		permissions: ['member.read']
	}
};

const noPermLocals = {
	user: { id: 'u3' },
	organization: {
		id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		role: { id: 'r3', name: 'No Access' },
		permissions: []
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
		mockClient.query.mockImplementation(async (sql: string) =>
			String(sql).includes('FROM auth.member') ? { rows: members } : { rows: [] }
		);

		const result = await load({ locals: staffLocals } as any);
		expect(result.members).toEqual(members);
	});

	it('includes canRemoveMembers based on permissions', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await load({ locals: staffLocals } as any);
		// staffLocals has member:read but not member:delete
		expect(result.canRemoveMembers).toBe(false);
	});

	it('resolves for owner locals', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await load({ locals: ownerLocals } as any);
		expect(result.members).toEqual([]);
	});

	it('releases the db client', async () => {
		await load({ locals: staffLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
