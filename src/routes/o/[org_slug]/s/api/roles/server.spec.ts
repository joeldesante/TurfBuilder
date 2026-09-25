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

import { GET, POST } from './+server';

// withOrgTransaction rejects anything that is not a UUID.
const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// can() reads the permissions hooks.server.ts resolved onto locals.organization.
const ownerLocals = {
	user: { id: 'u1' },
	organization: { id: ORG, permissions: ['role.read', 'role.create'] }
};

const memberLocals = {
	user: { id: 'u2' },
	organization: { id: ORG, permissions: ['role.read'] }
};

const noRoleLocals = {
	user: { id: 'u3' },
	organization: { id: ORG, permissions: [] }
};

function makeRequest(body: unknown) {
	return { json: () => Promise.resolve(body) } as any;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/roles', () => {
	it('returns 403 without role.read', async () => {
		const response = await GET({ locals: noRoleLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(403);
		expect(body.error).toBeTruthy();
	});

	it('returns 200 with roles list for a member with role.read', async () => {
		const rows = [
			{ id: 'r1', name: 'Owner', is_owner: true, is_default: false, permissions: null }
		];
		mockClient.query.mockResolvedValue({ rows });

		const response = await GET({ locals: memberLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(rows);
	});

	it('releases the db client', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });
		await GET({ locals: memberLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});

describe('POST /api/roles', () => {
	it('returns 403 without role.create', async () => {
		const response = await POST({ request: makeRequest({ name: 'Editor' }), locals: memberLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(403);
		expect(body.error).toBeTruthy();
	});

	it('returns 400 when name is empty', async () => {
		const response = await POST({ request: makeRequest({ name: '' }), locals: ownerLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(400);
	});

	it('returns 400 when name is whitespace', async () => {
		const response = await POST({ request: makeRequest({ name: '   ' }), locals: ownerLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(400);
	});

	it('returns 201 with the new role on success', async () => {
		const newRole = { id: 'r-new', name: 'Editor', is_owner: false, is_default: false };
		mockClient.query.mockResolvedValue({ rows: [newRole] });

		const response = await POST({ request: makeRequest({ name: 'Editor' }), locals: ownerLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual(newRole);
	});

	it('releases the db client after creating', async () => {
		mockClient.query.mockResolvedValue({ rows: [{ id: 'r-new', name: 'Test' }] });
		await POST({ request: makeRequest({ name: 'Test' }), locals: ownerLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
