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

import { GET } from './+server';

const ownerLocals = {
	user: { id: 'u1' },
	organization: {
		id: 'org-1',
		role: { id: 'r1', is_owner: true, is_default: false, permissions: null }
	}
};

const memberLocals = {
	user: { id: 'u2' },
	organization: {
		id: 'org-1',
		role: { id: 'r2', is_owner: false, is_default: true, permissions: ['member:read'] }
	}
};

const noRoleLocals = {
	user: { id: 'u3' },
	organization: { id: 'org-1', role: null }
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/members', () => {
	it('returns 403 when caller lacks member:read permission', async () => {
		const localsWithNoPermission = {
			user: { id: 'u4' },
			organization: {
				id: 'org-1',
				role: { id: 'r3', is_owner: false, is_default: false, permissions: [] }
			}
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
