import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
	insertAddress,
	createAddressVersion,
	softDeleteAddress,
	splitAddress
} from './addresses.service';
import type { AddressFields } from '$lib/schemas/address';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OLD_VERSION = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NEW_VERSION = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';

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
		expect(version.params.slice(13, 16)).toEqual([null, null, null]);
		expect(version.params.slice(16, 18)).toEqual([-75.18, 39.98]);
		expect(version.params.slice(18)).toEqual([USER, 'manual']);
	});

	it('stores a unit as an address of its own', async () => {
		query
			.mockResolvedValueOnce({ rows: [{ id: ENTITY }] })
			.mockResolvedValueOnce({ rows: [{ id: NEW_VERSION }] });

		await insertAddress(client, ORG, { ...fields, unit_type: 'Apt', unit_identifier: '4B', floor: '4' }, USER, 'manual');

		expect(find('INSERT INTO universe.org_address')!.params.slice(13, 16)).toEqual(['Apt', '4B', '4']);
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
	it('closes the version without a successor', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] });

		const closed = await softDeleteAddress(client, ORG, ENTITY);

		expect(closed).toBe(OLD_VERSION);
		expect(issued()).toHaveLength(1);
		expect(find('UPDATE universe.org_address SET valid_to')!.params).toEqual([ENTITY, ORG]);
	});
});

describe('splitAddress', () => {
	it('closes the old address and links each new one back to it', async () => {
		query
			.mockResolvedValueOnce({ rows: [{ id: OLD_VERSION }] }) // close old version
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
