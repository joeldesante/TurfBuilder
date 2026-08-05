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
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_VERSION = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';

const params = { entity_id: ENTITY };

const current = {
	id: OLD_VERSION,
	entity_id: ENTITY,
	name: 'Rosa Deli',
	address_line_1: '123 Main St',
	address_line_2: 'Suite 4',
	address_line_3: null,
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19104',
	country_code: 'US',
	latitude: 39.9526,
	longitude: -75.1652,
	photo_keys: []
};

function locals(permissions: string[]) {
	return { user: { id: 'u1' }, organization: { id: ORG, permissions } };
}

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

/** Default happy path: the location exists and versioning succeeds. */
function stubLiveLocation() {
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('FOR UPDATE')) return { rows: [current] };
		if (sql.includes('SET valid_to = now()')) return { rows: [{ id: OLD_VERSION }] };
		if (sql.includes('INSERT INTO universe.org_location')) return { rows: [{ id: NEW_VERSION }] };
		return { rows: [] };
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	stubLiveLocation();
});

describe('PATCH /s/api/universe/locations/[entity_id]', () => {
	it('rejects a caller without location.update', async () => {
		const response = await PATCH({
			request: makeRequest({ name: 'New' }),
			params,
			locals: locals(['location.read'])
		} as never);

		expect(response.status).toBe(403);
	});

	it('supersedes the current version', async () => {
		const response = await PATCH({
			request: makeRequest({ name: 'Rosa Deli & Grocery' }),
			params,
			locals: locals(['location.update'])
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ entity_id: ENTITY, id: NEW_VERSION });
		expect(find('SET valid_to = now()')).toBeDefined();
		expect(find('INSERT INTO universe.org_location')).toBeDefined();
	});

	// Version rows carry the whole record, so a partial patch has to be merged
	// over the live row or the omitted fields would be written as null.
	it('carries unpatched fields onto the new version', async () => {
		await PATCH({
			request: makeRequest({ name: 'Rosa Deli & Grocery' }),
			params,
			locals: locals(['location.update'])
		} as never);

		const insert = find('INSERT INTO universe.org_location')!;
		expect(insert.params[2]).toBe('Rosa Deli & Grocery');
		expect(insert.params[3]).toBe('123 Main St');
		expect(insert.params[6]).toBe('Philadelphia');
	});

	it('clears a field explicitly patched to null', async () => {
		await PATCH({
			request: makeRequest({ address_line_2: null }),
			params,
			locals: locals(['location.update'])
		} as never);

		const insert = find('INSERT INTO universe.org_location')!;
		expect(insert.params[4]).toBeNull();
	});

	it('repoints turf assignments at the new version', async () => {
		await PATCH({
			request: makeRequest({ name: 'New' }),
			params,
			locals: locals(['location.update'])
		} as never);

		const repoint = find('UPDATE universe.turf_location');
		expect(repoint).toBeDefined();
		expect(repoint!.params).toEqual([NEW_VERSION, OLD_VERSION, ORG]);
	});

	it('locks the current version before superseding it', async () => {
		await PATCH({
			request: makeRequest({ name: 'New' }),
			params,
			locals: locals(['location.update'])
		} as never);

		expect(find('FOR UPDATE')).toBeDefined();
	});

	it('returns 404 for an entity in another org', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const response = await PATCH({
			request: makeRequest({ name: 'New' }),
			params,
			locals: locals(['location.update'])
		} as never);

		expect(response.status).toBe(404);
	});

	it('rejects an invalid patch', async () => {
		const response = await PATCH({
			request: makeRequest({ latitude: 999 }),
			params,
			locals: locals(['location.update'])
		} as never);

		expect(response.status).toBe(400);
	});
});

describe('DELETE /s/api/universe/locations/[entity_id]', () => {
	it('rejects a caller without location.delete', async () => {
		const response = await DELETE({ params, locals: locals(['location.update']) } as never);

		expect(response.status).toBe(403);
	});

	it('closes the current version', async () => {
		const response = await DELETE({ params, locals: locals(['location.delete']) } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(find('SET valid_to = now()')).toBeDefined();
	});

	// Soft delete: history, turf assignments, and past responses all survive.
	it('inserts no successor version and deletes nothing', async () => {
		await DELETE({ params, locals: locals(['location.delete']) } as never);

		expect(find('INSERT INTO universe.org_location')).toBeUndefined();
		expect(issued().some((q) => q.includes('DELETE FROM'))).toBe(false);
		expect(find('UPDATE universe.turf_location')).toBeUndefined();
	});

	it('returns 404 when the location is already gone', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const response = await DELETE({ params, locals: locals(['location.delete']) } as never);

		expect(response.status).toBe(404);
	});
});
