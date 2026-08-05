import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
	insertLocation,
	createLocationVersion,
	softDeleteLocation,
	readCurrentVersion,
	mergeLocationFields,
	type CurrentVersion
} from './locations';
import type { LocationFields } from '$lib/schemas/location';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_VERSION = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
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

beforeEach(() => {
	vi.clearAllMocks();
	query.mockResolvedValue({ rows: [] });
});

describe('insertLocation', () => {
	beforeEach(() => {
		query
			.mockResolvedValueOnce({ rows: [{ id: ENTITY }] })
			.mockResolvedValueOnce({ rows: [{ id: NEW_VERSION }] });
	});

	it('creates the identity row before the version row', async () => {
		await insertLocation(client, ORG, fields, USER, 'manual');
		const sql = issued();
		expect(sql[0]).toContain('INSERT INTO universe.org_entity');
		expect(sql[1]).toContain('INSERT INTO universe.org_location');
	});

	it('returns both the entity id and the first version id', async () => {
		const result = await insertLocation(client, ORG, fields, USER, 'manual');
		expect(result).toEqual({ entityId: ENTITY, versionId: NEW_VERSION });
	});

	it('leaves type_id to the set_entity_type trigger', async () => {
		await insertLocation(client, ORG, fields, USER, 'manual');
		expect(issued()[0]).not.toContain('type_id');
	});

	it('builds the point as longitude-then-latitude', async () => {
		await insertLocation(client, ORG, fields, USER, 'manual');
		const insert = find('INSERT INTO universe.org_location')!;
		expect(insert.sql).toContain('ST_SetSRID(ST_MakePoint($11::float8, $12::float8), 4326)');
		expect(insert.params[10]).toBe(fields.longitude);
		expect(insert.params[11]).toBe(fields.latitude);
	});
});

describe('createLocationVersion', () => {
	beforeEach(() => {
		query
			.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] })
			.mockResolvedValueOnce({ rows: [{ id: NEW_VERSION }] })
			.mockResolvedValue({ rows: [] });
	});

	it('closes the current version before inserting the successor', async () => {
		await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		const sql = issued();
		expect(sql[0]).toContain('SET valid_to = now()');
		expect(sql[0]).toContain('valid_to IS NULL');
		expect(sql[1]).toContain('INSERT INTO universe.org_location');
	});

	it('repoints turf_location from the old version to the new one', async () => {
		await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		const update = find('UPDATE universe.turf_location');
		expect(update).toBeDefined();
		expect(update!.params).toEqual([NEW_VERSION, OLD_VERSION, ORG]);
	});

	it('scopes the turf_location repoint to the org', async () => {
		await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		expect(find('UPDATE universe.turf_location')!.sql).toContain('org_id = $3');
	});

	it('repoints list_entry from the old version to the new one', async () => {
		await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		const update = find('UPDATE universe.list_entry');
		expect(update).toBeDefined();
		expect(update!.params).toEqual([NEW_VERSION, OLD_VERSION, ORG]);
	});

	// list_entry has no org_id column and no RLS policy, so joining
	// universe.list is the only thing keeping this update inside the tenant.
	it('scopes the list_entry repoint via a join to universe.list', async () => {
		await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		const sql = find('UPDATE universe.list_entry')!.sql;
		expect(sql).toContain('FROM universe.list l');
		expect(sql).toContain('l.id = le.list_id');
		expect(sql).toContain('l.org_id = $3');
	});

	it('only repoints org_location entries, not person entries', async () => {
		await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		expect(find('UPDATE universe.list_entry')!.sql).toContain("le.record_source = 'org_location'");
	});

	it('returns both version ids', async () => {
		const result = await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');
		expect(result).toEqual({ oldVersionId: OLD_VERSION, newVersionId: NEW_VERSION });
	});

	it('skips both repoints when there was no live version to supersede', async () => {
		// mockReset, not clearAllMocks: the latter leaves the queue of
		// mockResolvedValueOnce values from beforeEach in place.
		query.mockReset();
		query
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ id: NEW_VERSION }] })
			.mockResolvedValue({ rows: [] });

		const result = await createLocationVersion(client, ORG, ENTITY, fields, USER, 'manual');

		expect(result.oldVersionId).toBeNull();
		expect(find('UPDATE universe.turf_location')).toBeUndefined();
		expect(find('UPDATE universe.list_entry')).toBeUndefined();
	});
});

describe('softDeleteLocation', () => {
	it('closes the current version and inserts no successor', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });
		await softDeleteLocation(client, ORG, ENTITY);
		const sql = issued();
		expect(sql[0]).toContain('SET valid_to = now()');
		expect(sql.some((q) => q.includes('INSERT INTO universe.org_location'))).toBe(false);
	});

	// turf_location_attempt and survey_question_response cascade off
	// turf_location, so removing it would destroy canvassing history.
	it('leaves turf_location rows in place', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });
		await softDeleteLocation(client, ORG, ENTITY);
		expect(find('UPDATE universe.turf_location')).toBeUndefined();
		expect(issued().some((q) => q.includes('DELETE'))).toBe(false);
	});

	it('returns the closed version id', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });
		await expect(softDeleteLocation(client, ORG, ENTITY)).resolves.toBe(OLD_VERSION);
	});

	it('returns null when there was no live version', async () => {
		query.mockResolvedValueOnce({ rows: [] });
		await expect(softDeleteLocation(client, ORG, ENTITY)).resolves.toBeNull();
	});
});

describe('readCurrentVersion', () => {
	it('reads only the live version and locks it', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });
		await readCurrentVersion(client, ORG, ENTITY);
		const sql = issued()[0];
		expect(sql).toContain('ol.valid_to IS NULL');
		expect(sql).toContain('FOR UPDATE');
	});

	it('projects coordinates back to latitude and longitude', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });
		await readCurrentVersion(client, ORG, ENTITY);
		const sql = issued()[0];
		expect(sql).toContain('ST_Y(ol.coordinates) AS latitude');
		expect(sql).toContain('ST_X(ol.coordinates) AS longitude');
	});

	it('returns null for an entity outside the org', async () => {
		query.mockResolvedValueOnce({ rows: [] });
		await expect(readCurrentVersion(client, ORG, ENTITY)).resolves.toBeNull();
	});
});

describe('mergeLocationFields', () => {
	const current: CurrentVersion = { id: OLD_VERSION, entity_id: ENTITY, ...fields };

	it('keeps current values for keys absent from the patch', () => {
		const merged = mergeLocationFields(current, { name: 'Rosa Deli & Grocery' });
		expect(merged.name).toBe('Rosa Deli & Grocery');
		expect(merged.address_line_1).toBe('123 Main St');
		expect(merged.city).toBe('Philadelphia');
		expect(merged.latitude).toBe(fields.latitude);
	});

	it('clears a field explicitly patched to null', () => {
		const merged = mergeLocationFields(current, { address_line_2: null, postal_code: null });
		expect(merged.address_line_2).toBeNull();
		expect(merged.postal_code).toBeNull();
	});

	it('produces a complete field set from an empty patch', () => {
		expect(mergeLocationFields(current, {})).toEqual(fields);
	});

	it('moves coordinates when both are patched', () => {
		const merged = mergeLocationFields(current, { latitude: 40.1, longitude: -75.9 });
		expect(merged.latitude).toBe(40.1);
		expect(merged.longitude).toBe(-75.9);
	});
});
