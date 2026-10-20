import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
	ContactError,
	createContactVersion,
	insertContact,
	readCurrentContact,
	softDeleteContact,
	type ContactFields
} from './contacts.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ENTITY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADDRESS = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';

const fields: ContactFields = {
	type: 'business',
	addressEntityId: ADDRESS,
	metadata: { name: 'Green Market' },
	photoKeys: ['p.jpg']
};

const query = vi.fn();
const client = { query } as unknown as PoolClient;

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

describe('insertContact', () => {
	it('checks the address, then writes a version with the validated metadata', async () => {
		query
			.mockResolvedValueOnce({ rows: [{}] }) // address is live
			.mockResolvedValueOnce({ rows: [{ id: ENTITY }] }) // entity
			.mockResolvedValueOnce({ rows: [{ id: 'v1' }] }); // version

		const result = await insertContact(client, ORG, fields, USER, 'manual');

		expect(result).toEqual({ entityId: ENTITY, versionId: 'v1' });
		const check = find('FROM universe.org_address')!;
		expect(check.sql).toContain('valid_to IS NULL');
		expect(check.params).toEqual([ADDRESS, ORG]);
		expect(find('INSERT INTO universe.org_contact')!.params).toEqual([
			ORG,
			ENTITY,
			'business',
			ADDRESS,
			'{"name":"Green Market"}',
			['p.jpg'],
			USER,
			'manual'
		]);
	});

	it('reuses an existing entity when one is given', async () => {
		query.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [{ id: 'v1' }] });

		const result = await insertContact(client, ORG, fields, null, 'backfill', ENTITY);

		expect(result.entityId).toBe(ENTITY);
		expect(issued().some((q) => q.includes('INSERT INTO universe.org_entity'))).toBe(false);
	});

	it('rejects metadata that does not fit the type, before touching the database', async () => {
		await expect(
			insertContact(client, ORG, { ...fields, metadata: { title: 'x' } }, USER, 'manual')
		).rejects.toThrow(ContactError);
		expect(query).not.toHaveBeenCalled();
	});

	it('rejects an address that is not live', async () => {
		await expect(insertContact(client, ORG, fields, USER, 'manual')).rejects.toThrow(
			'The address for this contact no longer exists.'
		);
		expect(issued().some((q) => q.includes('INSERT'))).toBe(false);
	});
});

describe('createContactVersion', () => {
	it('closes the current version before inserting the successor', async () => {
		query
			.mockResolvedValueOnce({ rows: [{}] })
			.mockResolvedValueOnce({ rows: [{ id: 'v1' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'v2' }] });

		const result = await createContactVersion(client, ORG, ENTITY, fields, USER, 'manual');

		expect(result).toEqual({ oldVersionId: 'v1', newVersionId: 'v2' });
		expect(issued()[1]).toContain('UPDATE universe.org_contact SET valid_to = now()');
		expect(issued()[1]).toContain('org_id = $2');
		expect(issued()[2]).toContain('INSERT INTO universe.org_contact');
	});
});

describe('softDeleteContact', () => {
	it('closes the current version without a successor', async () => {
		query.mockResolvedValueOnce({ rows: [{ id: 'v1' }] });

		expect(await softDeleteContact(client, ORG, ENTITY)).toBe('v1');
		expect(issued()).toHaveLength(1);
		expect(find('UPDATE universe.org_contact')!.params).toEqual([ENTITY, ORG]);
	});
});

describe('readCurrentContact', () => {
	it('reads only the live version in the org', async () => {
		expect(await readCurrentContact(client, ORG, ENTITY)).toBeNull();
		expect(issued()[0]).toContain('valid_to IS NULL');
		expect(issued()[0]).toContain('org_id = $2');
	});
});
