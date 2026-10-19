import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
	insertAddress,
	createAddressVersion,
	softDeleteAddress,
	splitAddress,
	addUnit,
	softDeleteUnit,
	listUnits
} from './addresses.service';
import type { AddressFields } from '$lib/schemas/address';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_VERSION = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UNIT = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890';

const fields: AddressFields = {
	premises_number: '2445',
	thoroughfare_name: 'Harlan',
	thoroughfare_type: 'St',
	locality: 'Philadelphia',
	region: 'PA',
	postcode: '19121',
	country_code: 'US',
	latitude: 39.98,
	longitude: -75.18
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
	query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('insertAddress', () => {
	it('creates the entity, then its first version with the point as longitude, latitude', async () => {
		query
			.mockResolvedValueOnce({ rows: [{ id: ENTITY }] })
			.mockResolvedValueOnce({ rows: [{ id: NEW_VERSION }] });

		const result = await insertAddress(client, ORG, fields, USER, 'manual');

		expect(result).toEqual({ entityId: ENTITY, versionId: NEW_VERSION });
		expect(issued()[0]).toContain('INSERT INTO universe.org_entity');
		const version = find('INSERT INTO universe.org_address')!;
		expect(version.params.slice(0, 4)).toEqual([ORG, ENTITY, null, '2445']);
		expect(version.params[12]).toBe('US');
		expect(version.params.slice(13, 15)).toEqual([-75.18, 39.98]);
		expect(version.params.slice(15)).toEqual([USER, 'manual']);
	});
});

describe('createAddressVersion', () => {
	it('closes the current version before inserting the successor', async () => {
		query
			.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] })
			.mockResolvedValueOnce({ rows: [{ id: NEW_VERSION }] });

		const result = await createAddressVersion(client, ORG, ENTITY, fields, USER, 'manual');

		expect(result).toEqual({ oldVersionId: OLD_VERSION, newVersionId: NEW_VERSION });
		expect(issued()[0]).toContain('UPDATE universe.org_address SET valid_to = now()');
		expect(issued()[0]).toContain('org_id = $2');
		expect(issued()[1]).toContain('INSERT INTO universe.org_address');
	});
});

describe('softDeleteAddress', () => {
	it('closes the version without a successor and soft-deletes the units', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });

		const closed = await softDeleteAddress(client, ORG, ENTITY, USER);

		expect(closed).toBe(OLD_VERSION);
		expect(issued().some((q) => q.includes('INSERT'))).toBe(false);
		const units = find('UPDATE universe.org_address_unit SET deleted_at')!;
		expect(units.sql).toContain('org_id = $2');
		expect(units.params).toEqual([ENTITY, ORG, USER]);
	});
});

describe('splitAddress', () => {
	it('closes the old address and links each new one back to it', async () => {
		query
			.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] }) // close old version
			.mockResolvedValueOnce({ rows: [] }) // soft-delete units
			.mockResolvedValueOnce({ rows: [{ id: 'new-a' }] }) // entity
			.mockResolvedValueOnce({ rows: [{ id: 'ver-a' }] }) // version
			.mockResolvedValueOnce({ rows: [] }) // relationship
			.mockResolvedValueOnce({ rows: [{ id: 'new-b' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'ver-b' }] })
			.mockResolvedValueOnce({ rows: [] });

		const created = await splitAddress(
			client,
			ORG,
			ENTITY,
			[fields, { ...fields, premises_number: '2447' }],
			USER,
			'manual'
		);

		expect(created).toEqual(['new-a', 'new-b']);
		const relationships = query.mock.calls.filter((c) =>
			String(c[0]).includes('INSERT INTO universe.org_relationship')
		);
		expect(relationships.map((c) => c[1])).toEqual([
			[ORG, 'new-a', ENTITY, 'split_from', USER, 'manual'],
			[ORG, 'new-b', ENTITY, 'split_from', USER, 'manual']
		]);
	});

	it('creates nothing when the old address is not live', async () => {
		expect(await splitAddress(client, ORG, ENTITY, [fields], USER, 'manual')).toBeNull();
		expect(issued().some((q) => q.includes('INSERT'))).toBe(false);
	});
});

describe('addUnit', () => {
	it('stamps the unit type and stores the unit under the address entity', async () => {
		query
			.mockResolvedValueOnce({ rows: [{}] }) // live address
			.mockResolvedValueOnce({ rows: [{ id: UNIT }] }) // entity
			.mockResolvedValueOnce({ rows: [] }); // unit row

		const unit = await addUnit(client, ORG, ENTITY, { unit_type: 'Apt', unit_identifier: '4B' });

		expect(unit).toBe(UNIT);
		expect(find('INSERT INTO universe.org_entity')!.sql).toContain("slug = 'unit'");
		expect(find('INSERT INTO universe.org_address_unit')!.params).toEqual([
			UNIT,
			ORG,
			ENTITY,
			'Apt',
			'4B',
			null
		]);
	});

	it('rejects a parent that is not a live address in the org', async () => {
		const unit = await addUnit(client, ORG, ENTITY, { unit_identifier: '4B' });

		expect(unit).toBeNull();
		expect(issued()[0]).toContain('FROM universe.org_address');
		expect(issued()[0]).toContain('valid_to IS NULL');
		expect(issued().some((q) => q.includes('INSERT'))).toBe(false);
	});
});

describe('softDeleteUnit', () => {
	it('reports whether a live unit was deleted', async () => {
		query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
		expect(await softDeleteUnit(client, ORG, UNIT, USER)).toBe(true);
		expect(await softDeleteUnit(client, ORG, UNIT, USER)).toBe(false);
	});
});

describe('listUnits', () => {
	it("reads coordinates from the address's current version", async () => {
		await listUnits(client, ORG, ENTITY);

		const sql = issued()[0];
		expect(sql).toContain('JOIN universe.org_address a');
		expect(sql).toContain('a.valid_to IS NULL');
		expect(sql).toContain('u.deleted_at IS NULL');
		expect(sql).toContain('u.org_id = $2');
	});
});
