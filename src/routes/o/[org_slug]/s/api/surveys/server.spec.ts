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

import { POST } from './+server';

// withOrgTransaction rejects anything that is not a UUID.
const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';

// The route requires a staff role, then checks can(), which reads the
// permissions hooks.server.ts resolved onto locals.organization.
const authorizedLocals = {
	user: { id: 'u1' },
	organization: { id: ORG, role: { id: 'r1', name: 'Organizer' }, permissions: ['survey.create'] }
};

const noPermissionLocals = {
	user: { id: 'u2' },
	organization: { id: ORG, role: { id: 'r2', name: 'Analyst' }, permissions: [] }
};

const unauthenticatedLocals = {
	user: null,
	organization: { id: ORG, permissions: [] }
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

	it('returns 403 when caller lacks survey.create permission', async () => {
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

	it('returns 400 when bucketId is missing', async () => {
		const response = await POST({ request: makeRequest({ name: 'My Survey' }), locals: authorizedLocals } as any);
		expect(response.status).toBe(400);
	});

	it('returns 201 with the new survey id on success', async () => {
		const response = await POST({
			request: makeRequest({ name: 'My Survey', bucketId: BUCKET }),
			locals: authorizedLocals
		} as any);
		const body = await response.json();
		expect(response.status).toBe(201);
		expect(body.id).toBe('survey-new');
	});
});
