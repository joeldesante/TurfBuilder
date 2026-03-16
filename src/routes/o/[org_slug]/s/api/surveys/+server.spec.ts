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

import { POST } from './+server';

const authorizedLocals = {
	user: { id: 'u1' },
	organization: {
		id: 'org-1',
		role: { id: 'r1', is_owner: false, is_default: false, permissions: ['survey:create'] }
	}
};

const noPermissionLocals = {
	user: { id: 'u2' },
	organization: {
		id: 'org-1',
		role: { id: 'r2', is_owner: false, is_default: false, permissions: [] }
	}
};

const unauthenticatedLocals = {
	user: null,
	organization: { id: 'org-1', role: null }
};

function makeRequest(body: unknown) {
	return { json: () => Promise.resolve(body) } as any;
}

beforeEach(() => {
	vi.clearAllMocks();
	// Default mock: withOrgTransaction wraps the fn and returns the result
	mockClient.query.mockResolvedValue({ rows: [{ id: 'survey-new' }] });
});

describe('POST /api/surveys', () => {
	it('returns 401 when no role is present', async () => {
		const response = await POST({ request: makeRequest({ name: 'Test' }), locals: unauthenticatedLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(401);
	});

	it('returns 403 when caller lacks survey:create permission', async () => {
		const response = await POST({ request: makeRequest({ name: 'Test' }), locals: noPermissionLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(403);
	});

	it('returns 400 when name is empty', async () => {
		const response = await POST({ request: makeRequest({ name: '' }), locals: authorizedLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(400);
	});

	it('returns 400 when name is whitespace only', async () => {
		const response = await POST({ request: makeRequest({ name: '   ' }), locals: authorizedLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(400);
	});

	it('returns 400 when name exceeds 255 characters', async () => {
		const response = await POST({
			request: makeRequest({ name: 'a'.repeat(256) }),
			locals: authorizedLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(400);
	});

	it('returns 201 with the new survey id on success', async () => {
		const response = await POST({ request: makeRequest({ name: 'My Survey' }), locals: authorizedLocals } as any);
		const body = await response.json();
		expect(response.status).toBe(201);
		expect(body.id).toBe('survey-new');
	});
});
