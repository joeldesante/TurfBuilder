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
const TURF = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TURF_LOCATION = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';

const params = { id: TURF };
const volunteer = { user: { id: 'u1' }, organization: { id: ORG, permissions: [] } };

const body = {
	name: 'New Bodega',
	address_line_1: '900 Pine St',
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19104',
	country_code: 'US',
	latitude: 39.95,
	longitude: -75.16,
	photo_keys: ['orgs/o1/locations/a.webp']
};

function makeRequest(payload: unknown) {
	return { json: () => Promise.resolve(payload) } as never;
}

function issued(): string[] {
	return mockClient.query.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim());
}

function find(fragment: string) {
	const idx = issued().findIndex((q) => q.includes(fragment));
	if (idx === -1) return undefined;
	return { sql: issued()[idx], params: mockClient.query.mock.calls[idx][1] as unknown[] };
}

/**
 * Happy path: the volunteer is on an open turf, the pin is inside it, and
 * they are under the suggestion cap.
 */
function stubAllowed(overrides: { inside?: boolean; openCount?: number } = {}) {
	const { inside = true, openCount = 0 } = overrides;
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('JOIN universe.turf_user')) return { rows: [{ id: TURF, bounds: '{}' }] };
		if (sql.includes('ST_Contains')) return { rows: [{ inside }] };
		if (sql.includes('count(*)::int')) return { rows: [{ n: openCount }] };
		if (sql.includes('INSERT INTO universe.org_entity')) return { rows: [{ id: ENTITY }] };
		if (sql.includes('INSERT INTO universe.org_location')) return { rows: [{ id: VERSION }] };
		if (sql.includes('INSERT INTO universe.turf_location'))
			return { rows: [{ id: TURF_LOCATION }] };
		return { rows: [] };
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	stubAllowed();
});

describe('POST /o/[org_slug]/map/[id]/locations', () => {
	it('rejects a signed-out caller', async () => {
		const response = await POST({
			request: makeRequest(body),
			params,
			locals: { user: null, organization: null }
		} as never);

		expect(response.status).toBe(401);
	});

	// Membership, expiry, and org scope are all one query; no row means no write.
	it('rejects a caller who is not on the turf or whose turf expired', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const response = await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		expect(response.status).toBe(403);
		expect(find('INSERT INTO universe.org_entity')).toBeUndefined();
	});

	it('checks turf membership and expiry together', async () => {
		await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		const gate = find('JOIN universe.turf_user')!;
		expect(gate.sql).toContain('t.expires_at IS NULL OR t.expires_at > now()');
		expect(gate.params).toEqual([TURF, 'u1', ORG]);
	});

	// Without the geofence a volunteer could put pins anywhere on earth into the
	// organization's dataset.
	it('rejects a pin outside the turf', async () => {
		stubAllowed({ inside: false });

		const response = await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		expect(response.status).toBe(422);
		expect(await response.json()).toEqual({ error: 'Pin must be inside your turf.' });
		expect(find('INSERT INTO universe.org_entity')).toBeUndefined();
	});

	it('rejects once the volunteer is at the open-suggestion cap', async () => {
		stubAllowed({ openCount: 25 });

		const response = await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		expect(response.status).toBe(429);
		expect(find('INSERT INTO universe.org_entity')).toBeUndefined();
	});

	it('creates the location, marks it tentative, and attaches it to the turf', async () => {
		const response = await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			turf_location_id: TURF_LOCATION,
			entity_id: ENTITY
		});
		expect(find('INSERT INTO universe.location_suggestion')).toBeDefined();
		expect(find('INSERT INTO universe.turf_location')).toBeDefined();
	});

	it('records the suggestion as tentative against the author and turf', async () => {
		await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		const suggestion = find('INSERT INTO universe.location_suggestion')!;
		expect(suggestion.sql).toContain("'tentative'");
		expect(suggestion.params).toEqual([ORG, ENTITY, TURF, 'u1']);
	});

	// The turf assignment points at the version row, which is what the survey
	// screen loads, so the volunteer can knock it immediately.
	it('attaches the new version row to the turf', async () => {
		await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		expect(find('INSERT INTO universe.turf_location')!.params).toEqual([ORG, TURF, VERSION]);
	});

	it('stores the attached photos', async () => {
		await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		const insert = find('INSERT INTO universe.org_location')!;
		expect(insert.params[12]).toEqual(['orgs/o1/locations/a.webp']);
	});

	it('attributes the version to the volunteer', async () => {
		await POST({ request: makeRequest(body), params, locals: volunteer } as never);

		const insert = find('INSERT INTO universe.org_location')!;
		expect(insert.params[13]).toBe('u1');
		expect(insert.params[14]).toBe('volunteer_suggestion');
	});

	it('rejects an invalid body before touching the turf', async () => {
		const response = await POST({
			request: makeRequest({ ...body, latitude: 500 }),
			params,
			locals: volunteer
		} as never);

		expect(response.status).toBe(400);
		expect(mockClient.query).not.toHaveBeenCalled();
	});

	it('rejects more than three photos', async () => {
		const response = await POST({
			request: makeRequest({ ...body, photo_keys: ['a', 'b', 'c', 'd'] }),
			params,
			locals: volunteer
		} as never);

		expect(response.status).toBe(400);
	});
});
