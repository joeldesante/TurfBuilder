import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factory, which vitest lifts above this file's consts,
// can still reach it.
const { mockClient } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

import { load } from './+page.server';

// withOrgTransaction rejects anything that is not a valid UUID.
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
	mockClient.query.mockResolvedValue({ rows: [] });
});

describe('settings/roles page load', () => {
	it('throws 403 without role.read', async () => {
		await expect(load({ locals: memberLocals } as any)).rejects.toMatchObject({ status: 403 });
	});

	it('returns roles array with role.read', async () => {
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
