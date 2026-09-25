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

vi.mock('nanoid', () => ({ nanoid: vi.fn(() => 'mock-token-21chars-xxx') }));

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// can() reads the permissions hooks.server.ts resolved onto locals.organization.
const ownerLocals = {
	user: { id: 'u1' },
	organization: { id: ORG, permissions: ['member.invite'] }
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

describe('GET /api/invite-links', () => {
	it('returns 403 without member.invite', async () => {
		const response = await GET({ locals: memberLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(403);
	});

	it('returns links and slugInviteEnabled with member.invite', async () => {
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
	it('returns 403 without member.invite', async () => {
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
