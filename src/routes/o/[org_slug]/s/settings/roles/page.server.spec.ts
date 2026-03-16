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

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const ownerLocals = {
	user: { id: 'u1' },
	organization: {
		id: ORG_ID,
		role: { id: 'r1', is_owner: true, is_default: false, permissions: null }
	}
};

const memberLocals = {
	user: { id: 'u2' },
	organization: {
		id: ORG_ID,
		role: { id: 'r2', is_owner: false, is_default: true, permissions: [] }
	}
};

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.query.mockResolvedValue({ rows: [] });
});

describe('settings/roles page load', () => {
	it('throws 403 when caller is not owner', async () => {
		await expect(load({ locals: memberLocals } as any)).rejects.toMatchObject({ status: 403 });
	});

	it('returns roles array for owner', async () => {
		const roles = [
			{ id: 'r1', name: 'Owner', is_owner: true, is_default: false, permissions: null }
		];
		// withOrgTransaction calls BEGIN, SET LOCAL, then the SELECT, then COMMIT, then RESET
		mockClient.query
			.mockResolvedValueOnce({ rows: [] }) // BEGIN
			.mockResolvedValueOnce({ rows: [] }) // SET LOCAL
			.mockResolvedValueOnce({ rows: roles }) // SELECT
			.mockResolvedValueOnce({ rows: [] }) // COMMIT
			.mockResolvedValueOnce({ rows: [] }); // RESET

		const result = await load({ locals: ownerLocals } as any);
		expect(result.roles).toEqual(roles);
	});

	it('returns empty roles array when no roles exist', async () => {
		const result = await load({ locals: ownerLocals } as any);
		expect(result.roles).toEqual([]);
	});

	it('releases the db client', async () => {
		await load({ locals: ownerLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
