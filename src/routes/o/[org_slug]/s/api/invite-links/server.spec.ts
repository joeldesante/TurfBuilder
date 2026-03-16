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

vi.mock('nanoid', () => ({ nanoid: vi.fn(() => 'mock-token-21chars-xxx') }));

import { GET, POST } from './+server';

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

describe('GET /api/invite-links', () => {
	it('returns 403 when caller is not owner', async () => {
		const response = await GET({ locals: memberLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(403);
	});

	it('returns links and slugInviteEnabled for owner', async () => {
		const links = [{ id: 'abc', created_at: '2025-01-01', expires_at: null }];
		mockClient.query
			.mockResolvedValueOnce({ rows: links })
			.mockResolvedValueOnce({ rows: [{ enabled: true }] });

		const response = await GET({ locals: ownerLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.links).toEqual(links);
		expect(body.slugInviteEnabled).toBe(true);
	});

	it('defaults slugInviteEnabled to false when no row exists', async () => {
		mockClient.query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });

		const response = await GET({ locals: ownerLocals } as any);
		const body = await response.json();

		expect(body.slugInviteEnabled).toBe(false);
	});

	it('releases the client', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });
		await GET({ locals: ownerLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});

describe('POST /api/invite-links', () => {
	it('returns 403 when caller is not owner', async () => {
		const response = await POST({ request: makeRequest({}), locals: memberLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(403);
	});

	it('returns 201 with the new link on success', async () => {
		const newLink = { id: 'mock-token-21chars-xxx', created_at: '2025-01-01', expires_at: null };
		mockClient.query.mockResolvedValue({ rows: [newLink] });

		const response = await POST({ request: makeRequest({}), locals: ownerLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual(newLink);
	});

	it('passes expires_at to the query when provided', async () => {
		const newLink = { id: 'mock-token-21chars-xxx', created_at: '2025-01-01', expires_at: '2026-01-01' };
		mockClient.query.mockResolvedValue({ rows: [newLink] });

		await POST({ request: makeRequest({ expires_at: '2026-01-01' }), locals: ownerLocals } as any);

		const queryCall = mockClient.query.mock.calls[0];
		expect(queryCall[1]).toContain('2026-01-01');
	});
});
