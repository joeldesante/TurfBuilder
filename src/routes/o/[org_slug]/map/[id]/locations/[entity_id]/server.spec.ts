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

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TURF = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_VERSION = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';

const params = { id: TURF, entity_id: ENTITY };
const volunteer = { user: { id: 'u1' }, organization: { id: ORG, permissions: [] } };

const current = {
	id: OLD_VERSION,
	entity_id: ENTITY,
	name: 'New Bodgea',
	address_line_1: '900 Pine St',
	address_line_2: null,
	address_line_3: null,
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19104',
	country_code: 'US',
	latitude: 39.95,
	longitude: -75.16,
	photo_keys: []
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

/** The volunteer still owns an unreviewed suggestion on an open turf. */
function stubEditable(overrides: { inside?: boolean } = {}) {
	const { inside = true } = overrides;
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('location_suggestion ls'))
			return { rows: [{ current_version_id: OLD_VERSION, bounds: '{}' }] };
		if (sql.includes('FOR UPDATE') && sql.includes('ST_Y')) return { rows: [current] };
		if (sql.includes('ST_Contains')) return { rows: [{ inside }] };
		if (sql.includes('SET valid_to = now()')) return { rows: [{ id: OLD_VERSION }] };
		if (sql.includes('INSERT INTO universe.org_location')) return { rows: [{ id: NEW_VERSION }] };
		return { rows: [] };
	});
}

/** The window has closed: approved, expired, or not theirs. */
function stubLocked() {
	mockClient.query.mockResolvedValue({ rows: [] });
}

beforeEach(() => {
	vi.clearAllMocks();
	stubEditable();
});

describe('PATCH /o/[org_slug]/map/[id]/locations/[entity_id]', () => {
	it('rejects a signed-out caller', async () => {
		const response = await PATCH({
			request: makeRequest({ name: 'New Bodega' }),
			params,
			locals: { user: null, organization: null }
		} as never);

		expect(response.status).toBe(401);
	});

	it('corrects the typo as a new version', async () => {
		const response = await PATCH({
			request: makeRequest({ name: 'New Bodega' }),
			params,
			locals: volunteer
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ entity_id: ENTITY, id: NEW_VERSION });
		expect(find('INSERT INTO universe.org_location')!.params[2]).toBe('New Bodega');
	});

	// The four conditions that close the editing window all live in one query.
	it('gates on authorship, tentative status, expiry, and assignment', async () => {
		await PATCH({ request: makeRequest({ name: 'x' }), params, locals: volunteer } as never);

		const gate = find('location_suggestion ls')!;
		expect(gate.sql).toContain('ls.user_id = $3');
		expect(gate.sql).toContain("ls.status = 'tentative'");
		expect(gate.sql).toContain('t.expires_at IS NULL OR t.expires_at > now()');
		expect(gate.sql).toContain('JOIN universe.turf_user tu');
	});

	it('refuses once the suggestion has been approved or the turf has closed', async () => {
		stubLocked();

		const response = await PATCH({
			request: makeRequest({ name: 'x' }),
			params,
			locals: volunteer
		} as never);

		expect(response.status).toBe(403);
		expect(find('INSERT INTO universe.org_location')).toBeUndefined();
	});

	it('carries unpatched fields onto the new version', async () => {
		await PATCH({
			request: makeRequest({ name: 'New Bodega' }),
			params,
			locals: volunteer
		} as never);

		const insert = find('INSERT INTO universe.org_location')!;
		expect(insert.params[3]).toBe('900 Pine St');
		expect(insert.params[6]).toBe('Philadelphia');
	});

	it('re-checks the geofence when the pin moves', async () => {
		stubEditable({ inside: false });

		const response = await PATCH({
			request: makeRequest({ latitude: 41, longitude: -70 }),
			params,
			locals: volunteer
		} as never);

		expect(response.status).toBe(422);
	});

	// Editing only the name must not pay for a spatial query.
	it('skips the geofence check when the pin has not moved', async () => {
		await PATCH({
			request: makeRequest({ name: 'New Bodega' }),
			params,
			locals: volunteer
		} as never);

		expect(find('ST_Contains')).toBeUndefined();
	});

	it('rejects an invalid patch', async () => {
		const response = await PATCH({
			request: makeRequest({ longitude: 900 }),
			params,
			locals: volunteer
		} as never);

		expect(response.status).toBe(400);
	});
});

describe('DELETE /o/[org_slug]/map/[id]/locations/[entity_id]', () => {
	it('rejects a signed-out caller', async () => {
		const response = await DELETE({
			params,
			locals: { user: null, organization: null }
		} as never);

		expect(response.status).toBe(401);
	});

	// Unlike the admin delete, withdrawing an unreviewed suggestion is a hard
	// delete: it has no history worth keeping and would otherwise leave a
	// phantom door on the turf.
	it('hard-deletes the entity so the cascade clears the turf assignment', async () => {
		const response = await DELETE({ params, locals: volunteer } as never);

		expect(response.status).toBe(200);
		const del = find('DELETE FROM universe.org_entity')!;
		expect(del.params).toEqual([ENTITY, ORG]);
	});

	it('scopes the delete to the caller org', async () => {
		await DELETE({ params, locals: volunteer } as never);

		expect(find('DELETE FROM universe.org_entity')!.sql).toContain('org_id = $2');
	});

	it('refuses once the suggestion has been approved or the turf has closed', async () => {
		stubLocked();

		const response = await DELETE({ params, locals: volunteer } as never);

		expect(response.status).toBe(403);
		expect(find('DELETE FROM universe.org_entity')).toBeUndefined();
	});
});
