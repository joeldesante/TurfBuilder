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

import { PATCH, DELETE } from './+server';

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
		role: { id: 'r2', is_owner: false, is_default: true, permissions: [] }
	}
};

function makeRequest(body: unknown) {
	return { json: () => Promise.resolve(body) } as any;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('PATCH /api/roles/[id]', () => {
	it('returns 403 when caller is not owner', async () => {
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
	it('returns 403 when caller is not owner', async () => {
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
