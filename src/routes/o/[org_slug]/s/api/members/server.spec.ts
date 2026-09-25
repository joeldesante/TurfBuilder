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

import { GET } from './+server';

// withOrgTransaction rejects anything that is not a UUID.
const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// can() reads the permissions hooks.server.ts resolved onto locals.organization.
const ownerLocals = {
	user: { id: 'u1' },
	organization: { id: ORG, permissions: ['member.read'] }
};

const memberLocals = {
	user: { id: 'u2' },
	organization: { id: ORG, permissions: ['member.read'] }
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/members', () => {
	it('returns 403 when caller lacks member.read permission', async () => {
		const localsWithNoPermission = {
			user: { id: 'u4' },
			organization: { id: ORG, permissions: [] }
		};

		const response = await GET({ locals: localsWithNoPermission } as any);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body.error).toBeTruthy();
	});

	it('returns 200 with members list for authorized user', async () => {
		const rows = [
			{ id: 'u1', name: 'Alice', email: 'alice@example.com', role_id: 'r1', role_name: 'Owner' }
		];
		mockClient.query.mockResolvedValue({ rows });

		const response = await GET({ locals: ownerLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.members).toEqual(rows);
	});

	it('returns empty members array when org has no members', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const response = await GET({ locals: memberLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.members).toEqual([]);
	});

	it('releases the db client after the query', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		await GET({ locals: ownerLocals } as any);

		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
