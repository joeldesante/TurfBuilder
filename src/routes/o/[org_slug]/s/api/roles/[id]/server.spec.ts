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

import { PATCH, DELETE } from './+server';

// withOrgTransaction rejects anything that is not a UUID.
const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// can() reads the permissions hooks.server.ts resolved onto locals.organization.
const ownerLocals = {
	user: { id: 'u1' },
	organization: { id: ORG, permissions: ['role.update', 'role.delete'] }
};

const memberLocals = {
	user: { id: 'u2' },
	organization: { id: ORG, permissions: [] }
};

function makeRequest(body: unknown) {
	return { json: () => Promise.resolve(body) } as any;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('PATCH /api/roles/[id]', () => {
	it('returns 403 without the role permission', async () => {
		const response = await PATCH({
			params: { id: 'r-target' },
			request: makeRequest({ name: 'New Name' }),
			locals: memberLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(403);
	});

	it('returns 400 when name is empty', async () => {
		const response = await PATCH({
			params: { id: 'r-target' },
			request: makeRequest({ name: '' }),
			locals: ownerLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(400);
	});

	it('returns 404 when role is not found or is the owner role', async () => {
		mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

		const response = await PATCH({
			params: { id: 'nonexistent' },
			request: makeRequest({ name: 'Updated' }),
			locals: ownerLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(404);
	});

	it('returns 200 with updated role on success', async () => {
		const updatedRole = { id: 'r-target', name: 'Updated Name', is_owner: false, is_default: false };
		mockClient.query.mockResolvedValue({ rows: [updatedRole], rowCount: 1 });

		const response = await PATCH({
			params: { id: 'r-target' },
			request: makeRequest({ name: 'Updated Name' }),
			locals: ownerLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body).toEqual(updatedRole);
	});
});

describe('DELETE /api/roles/[id]', () => {
	it('returns 403 without the role permission', async () => {
		const response = await DELETE({
			params: { id: 'r-target' },
			locals: memberLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(403);
	});

	it('returns 404 when role is not found or is owner/default', async () => {
		mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

		const response = await DELETE({
			params: { id: 'nonexistent' },
			locals: ownerLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(404);
	});

	it('returns 204 on successful deletion', async () => {
		mockClient.query.mockResolvedValue({ rowCount: 1 });

		const response = await DELETE({
			params: { id: 'r-target' },
			locals: ownerLocals
		} as any);
		expect(response.status).toBe(204);
	});

	it('releases the db client after deletion', async () => {
		mockClient.query.mockResolvedValue({ rowCount: 1 });

		await DELETE({ params: { id: 'r-target' }, locals: ownerLocals } as any);

		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
