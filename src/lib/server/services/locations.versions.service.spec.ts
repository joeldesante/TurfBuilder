import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
	insertLocation,
	createLocationVersion,
	softDeleteLocation,
	readCurrentVersion,
	mergeLocationFields,
	type CurrentVersion
} from './locations.service';
import type { LocationFields } from '$lib/schemas/location';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_CONTACT = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_CONTACT = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADDRESS_ENTITY = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_ADDRESS = 'a2b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_ADDRESS = 'a3b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';

const fields: LocationFields = {
	name: 'Rosa Deli',
	address_line_1: '123 Main St',
	address_line_2: null,
	address_line_3: null,
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19104',
	country_code: 'US',
	latitude: 39.9526,
	longitude: -75.1652,
	photo_keys: []
};

/** The live location as lockLocation reads it: Rosa Deli at 123 Main St. */
const LOCKED_ROW = {
	contact_id: OLD_CONTACT,
	type: 'business',
	metadata: { name: 'Rosa Deli' },
	photo_keys: [],
	address_id: OLD_ADDRESS,
	address_entity_id: ADDRESS_ENTITY,
	premises_name: null,
	premises_number: '123',
	thoroughfare_name: 'Main',
	thoroughfare_type: 'St',
	thoroughfare_pre_qualifier: null,
	thoroughfare_post_qualifier: null,
	dependent_locality: null,
	locality: 'Philadelphia',
	region: 'PA',
	postcode: '19104',
	country_code: 'US',
	unit_type: null,
	unit_identifier: null,
	floor: null,
	name: 'Rosa Deli',
	address_line_1: '123 Main St',
	address_line_2: null,
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19104',
	latitude: 39.9526,
	longitude: -75.1652
};

const query = vi.fn();
const client = { query } as unknown as PoolClient;

/** Queries issued, whitespace collapsed so assertions can match on fragments. */
function issued(): string[] {
	return query.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim());
}

function find(fragment: string): { sql: string; params: unknown[] } | undefined {
	const idx = issued().findIndex((q) => q.includes(fragment));
	if (idx === -1) return undefined;
	return { sql: issued()[idx], params: query.mock.calls[idx][1] as unknown[] };
}

/**
 * Answers queries by what they do. `live` is whether the location has a live
 * version; `shared` whether another live contact is at its address.
 */
function database({ live = true, shared = false } = {}) {
	query.mockImplementation(async (raw: string) => {
		const sql = raw.replace(/\s+/g, ' ');
		if (sql.includes('GROUP BY country_code')) return { rows: [{ country_code: 'US' }] };
		if (sql.includes('INSERT INTO universe.org_entity')) return { rows: [{ id: ENTITY }] };
		if (sql.includes('INSERT INTO universe.org_address')) return { rows: [{ id: NEW_ADDRESS }] };
		if (sql.includes('UPDATE universe.org_address')) return { rows: [{ id: OLD_ADDRESS }] };
		if (sql.includes('SELECT 1 FROM universe.org_address')) return { rows: [{}] };
		if (sql.includes('INSERT INTO universe.org_contact')) return { rows: [{ id: NEW_CONTACT }] };
		if (sql.includes('UPDATE universe.org_contact')) {
			return { rows: live ? [{ id: OLD_CONTACT }] : [] };
		}
		if (sql.includes('FOR UPDATE OF c, a')) return { rows: live ? [LOCKED_ROW] : [] };
		if (sql.includes('entity_id <> $3'))
			return { rows: shared ? [{}] : [], rowCount: shared ? 1 : 0 };
		if (sql.includes('SELECT 1 FROM universe.org_contact')) return { rows: [], rowCount: 0 };
		return { rows: [] };
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	database();
});

describe('insertLocation', () => {
	it('creates the address, then a business contact at it', async () => {
		const result = await insertLocation(client, ORG, fields, USER, 'manual');

		expect(result).toEqual({ entityId: ENTITY, versionId: NEW_CONTACT, addressId: NEW_ADDRESS });
		const order = issued();
		const address = order.findIndex((q) => q.includes('INSERT INTO universe.org_address'));
		const contact = order.findIndex((q) => q.includes('INSERT INTO universe.org_contact'));
		expect(address).toBeGreaterThan(-1);
		expect(contact).toBeGreaterThan(address);
	});

	it('maps the flat fields onto the address columns', async () => {
		await insertLocation(client, ORG, fields, USER, 'manual');

		const params = find('INSERT INTO universe.org_address')!.params;
		// premises_number, thoroughfare_name, thoroughfare_type, locality, region, postcode, country
		expect(params[3]).toBe('123');
		expect(params[4]).toBe('Main');
		expect(params[5]).toBe('St');
		expect(params[9]).toBe('Philadelphia');
		expect(params[10]).toBe('PA');
		expect(params[11]).toBe('19104');
		expect(params[12]).toBe('US');
		// The point is longitude then latitude.
		expect(params[16]).toBe(-75.1652);
		expect(params[17]).toBe(39.9526);
	});

	it('names the contact in its metadata', async () => {
		await insertLocation(client, ORG, fields, USER, 'manual');

		const params = find('INSERT INTO universe.org_contact')!.params;
		expect(params[2]).toBe('business');
		expect(JSON.parse(params[4] as string)).toEqual({ name: 'Rosa Deli' });
	});

	it('records a source ref on the contact entity', async () => {
		await insertLocation(client, ORG, fields, USER, 'import', 'row-7');

		const entity = query.mock.calls.filter((c) =>
			String(c[0]).includes('INSERT INTO universe.org_entity (org_id, source_ref)')
		);
		expect(entity.at(-1)![1]).toEqual([ORG, 'row-7']);
	});

	it('writes nothing to org_location', async () => {
		await insertLocation(client, ORG, fields, USER, 'manual');

		expect(issued().some((q) => q.includes('org_location'))).toBe(false);
	});
});

describe('createLocationVersion', () => {
	it('versions only the contact when the address is unchanged', async () => {
		const result = await createLocationVersion(
			client,
			ORG,
			ENTITY,
			{ ...fields, name: 'Rosa Market' },
			USER,
			'manual'
		);

		expect(result).toEqual({
			entityId: ENTITY,
			versionId: NEW_CONTACT,
			addressId: OLD_ADDRESS,
			oldVersionId: OLD_CONTACT
		});
		expect(find('INSERT INTO universe.org_address')).toBeUndefined();
		const contact = find('INSERT INTO universe.org_contact')!.params;
		expect(JSON.parse(contact[4] as string)).toEqual({ name: 'Rosa Market' });
	});

	it('versions the address when it changed and nothing else is there', async () => {
		const result = await createLocationVersion(
			client,
			ORG,
			ENTITY,
			{ ...fields, latitude: 39.95 },
			USER,
			'manual'
		);

		expect(result?.addressId).toBe(NEW_ADDRESS);
		expect(find('UPDATE universe.org_address SET valid_to = now()')).toBeDefined();
	});

	it('moves to a new address rather than moving one other contacts are at', async () => {
		database({ shared: true });

		await createLocationVersion(
			client,
			ORG,
			ENTITY,
			{ ...fields, address_line_1: '9 Pine St' },
			USER,
			'manual'
		);

		expect(find('UPDATE universe.org_address')).toBeUndefined();
		expect(find('INSERT INTO universe.org_entity (org_id, source_ref)')).toBeDefined();
	});

	it('leaves lists and turfs alone', async () => {
		await createLocationVersion(
			client,
			ORG,
			ENTITY,
			{ ...fields, latitude: 39.95 },
			USER,
			'manual'
		);

		expect(issued().some((q) => q.includes('turf_location') || q.includes('list_entry'))).toBe(
			false
		);
	});

	it('returns null when the location has no live version', async () => {
		database({ live: false });

		expect(await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual')).toBeNull();
		expect(find('INSERT INTO universe.org_contact')).toBeUndefined();
	});
});

describe('softDeleteLocation', () => {
	it('closes the contact and its address when nothing else is there', async () => {
		expect(await softDeleteLocation(client, ORG, ENTITY)).toBe(OLD_CONTACT);

		expect(find('UPDATE universe.org_contact SET valid_to = now()')!.params).toEqual([ENTITY, ORG]);
		expect(find('UPDATE universe.org_address SET valid_to = now()')!.params).toEqual([
			ADDRESS_ENTITY,
			ORG
		]);
		expect(find('INSERT INTO')).toBeUndefined();
	});

	it('returns null when there was no live version', async () => {
		database({ live: false });

		expect(await softDeleteLocation(client, ORG, ENTITY)).toBeNull();
	});
});

describe('readCurrentVersion', () => {
	it('reads the live contact at its live address, locked, in the flat shape', async () => {
		const current = await readCurrentVersion(client, ORG, ENTITY);

		expect(current).toMatchObject({
			id: OLD_CONTACT,
			entity_id: ENTITY,
			name: 'Rosa Deli',
			address_line_1: '123 Main St',
			city: 'Philadelphia',
			latitude: 39.9526
		});
		const read = find('FOR UPDATE OF c, a')!;
		expect(read.sql).toContain('c.valid_to IS NULL');
		expect(read.sql).toContain('a.valid_to IS NULL');
		expect(read.params).toEqual([ENTITY, ORG]);
	});

	it('returns null when the location is gone', async () => {
		database({ live: false });

		expect(await readCurrentVersion(client, ORG, ENTITY)).toBeNull();
	});
});

describe('mergeLocationFields', () => {
	const current: CurrentVersion = { ...fields, id: OLD_CONTACT, entity_id: ENTITY };

	it('keeps fields the patch leaves out and clears fields it sends as null', () => {
		const merged = mergeLocationFields(current, { name: 'Other', postal_code: null });

		expect(merged.name).toBe('Other');
		expect(merged.postal_code).toBeNull();
		expect(merged.city).toBe('Philadelphia');
		expect(merged).not.toHaveProperty('id');
	});
});
