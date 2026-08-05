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

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';

const allowed = {
	user: { id: 'u1' },
	organization: { id: ORG, permissions: ['location.create'] }
};

const denied = {
	user: { id: 'u2' },
	organization: { id: ORG, permissions: ['location.read'] }
};

const body = {
	name: 'Rosa Deli',
	address_line_1: '123 Main St',
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19104',
	country_code: 'US',
	latitude: 39.9526,
	longitude: -75.1652,
	photo_keys: []
};

function makeRequest(payload: unknown) {
	return { json: () => Promise.resolve(payload) } as never;
}

/** Queries issued, whitespace collapsed. */
function issued(): string[] {
	return mockClient.query.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim());
}

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('INSERT INTO universe.org_entity')) return { rows: [{ id: ENTITY }] };
		if (sql.includes('INSERT INTO universe.org_location')) return { rows: [{ id: VERSION }] };
		return { rows: [] };
	});
});

describe('POST /s/api/universe/locations', () => {
	it('rejects a caller without location.create', async () => {
		const response = await POST({ request: makeRequest(body), locals: denied } as never);

		expect(response.status).toBe(403);
	});

	it('rejects a caller with no organization', async () => {
		const response = await POST({
			request: makeRequest(body),
			locals: { user: { id: 'u1' }, organization: null }
		} as never);

		expect(response.status).toBe(403);
	});

	it('creates the entity and its first version', async () => {
		const response = await POST({ request: makeRequest(body), locals: allowed } as never);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ entity_id: ENTITY, id: VERSION });
	});

	it('scopes the write to the org transaction', async () => {
		await POST({ request: makeRequest(body), locals: allowed } as never);

		const sql = issued();
		expect(sql).toContain('BEGIN');
		expect(sql.some((q) => q.includes(`SET LOCAL app.current_org_id = '${ORG}'`))).toBe(true);
		expect(sql).toContain('COMMIT');
	});

	// An admin-authored location must be live at once, so it must not get a
	// tentative suggestion row.
	it('does not record a suggestion', async () => {
		await POST({ request: makeRequest(body), locals: allowed } as never);

		expect(issued().some((q) => q.includes('location_suggestion'))).toBe(false);
	});

	it('rejects a body with no coordinates', async () => {
		const { latitude, longitude, ...noCoords } = body;
		const response = await POST({ request: makeRequest(noCoords), locals: allowed } as never);

		expect(response.status).toBe(400);
	});

	it('rejects an out-of-range latitude', async () => {
		const response = await POST({
			request: makeRequest({ ...body, latitude: 120 }),
			locals: allowed
		} as never);

		expect(response.status).toBe(400);
	});

	it('rejects a country code that is not two characters', async () => {
		const response = await POST({
			request: makeRequest({ ...body, country_code: 'USA' }),
			locals: allowed
		} as never);

		expect(response.status).toBe(400);
	});

	it('rejects more than three photos', async () => {
		const response = await POST({
			request: makeRequest({ ...body, photo_keys: ['a', 'b', 'c', 'd'] }),
			locals: allowed
		} as never);

		expect(response.status).toBe(400);
	});
});
