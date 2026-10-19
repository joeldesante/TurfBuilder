import type { PoolClient } from 'pg';
import { validateContactMetadata } from '$lib/shared/contact-types';

/**
 * Contact writes. A contact is anything canvassed at an address (see
 * $lib/shared/contact-types for the kinds). It is versioned like the other
 * entities: universe.org_entity is the identity, universe.org_contact holds
 * one row per version, and an edit closes the current row and inserts a
 * successor.
 *
 * Every function expects to run inside withOrgTransaction (RLS is forced) and
 * still filters by org_id.
 */

export interface ContactFields {
	type: string;
	/** The address entity, which may be a unit. */
	addressEntityId: string;
	metadata: unknown;
	photoKeys?: string[];
}

export class ContactError extends Error {}

/**
 * Checks what the database cannot: the metadata fits its type, and the
 * address is a live address in this org (the foreign key only proves it is
 * some entity).
 */
async function checkFields(
	client: PoolClient,
	orgId: string,
	fields: ContactFields
): Promise<Record<string, unknown>> {
	const checked = validateContactMetadata(fields.type, fields.metadata);
	if (!checked.ok) throw new ContactError(checked.error);

	const address = await client.query(
		`SELECT 1 FROM universe.org_address
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL`,
		[fields.addressEntityId, orgId]
	);
	if (address.rows.length === 0) {
		throw new ContactError('The address for this contact no longer exists.');
	}

	return checked.metadata;
}

async function insertVersion(
	client: PoolClient,
	orgId: string,
	entityId: string,
	fields: ContactFields,
	metadata: Record<string, unknown>,
	authoredBy: string | null,
	source: string
): Promise<string> {
	const version = await client.query<{ id: string }>(
		`INSERT INTO universe.org_contact
			(org_id, entity_id, type, address_entity_id, metadata, photo_keys, authored_by, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id`,
		[
			orgId,
			entityId,
			fields.type,
			fields.addressEntityId,
			JSON.stringify(metadata),
			fields.photoKeys ?? [],
			authoredBy,
			source
		]
	);
	return version.rows[0].id;
}

/**
 * Creates a contact. Pass `entityId` to make an existing entity the contact,
 * as the location migration does; otherwise a new entity is created.
 *
 * @returns the contact's entity id and its first version id
 */
export async function insertContact(
	client: PoolClient,
	orgId: string,
	fields: ContactFields,
	authoredBy: string | null,
	source: string,
	entityId: string | null = null
): Promise<{ entityId: string; versionId: string }> {
	const metadata = await checkFields(client, orgId, fields);

	let id = entityId;
	if (!id) {
		const entity = await client.query<{ id: string }>(
			`INSERT INTO universe.org_entity (org_id) VALUES ($1) RETURNING id`,
			[orgId]
		);
		id = entity.rows[0].id;
	}

	const versionId = await insertVersion(client, orgId, id, fields, metadata, authoredBy, source);
	return { entityId: id, versionId };
}

/**
 * Closes the current version of a contact and inserts a successor with the
 * given (complete) fields. Moving a business to another address is a new
 * version pointing at the new address.
 *
 * @returns the superseded version id (null if there was no live version) and
 *   the new version id
 */
export async function createContactVersion(
	client: PoolClient,
	orgId: string,
	entityId: string,
	fields: ContactFields,
	authoredBy: string | null,
	source: string
): Promise<{ oldVersionId: string | null; newVersionId: string }> {
	const metadata = await checkFields(client, orgId, fields);

	const previous = await client.query<{ id: string }>(
		`UPDATE universe.org_contact SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
	);

	const newVersionId = await insertVersion(client, orgId, entityId, fields, metadata, authoredBy, source);
	return { oldVersionId: previous.rows[0]?.id ?? null, newVersionId };
}

/**
 * Soft-deletes a contact by closing its current version with no successor.
 *
 * @returns the closed version id, or null if the contact had no live version
 */
export async function softDeleteContact(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<string | null> {
	const result = await client.query<{ id: string }>(
		`UPDATE universe.org_contact SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
	);
	return result.rows[0]?.id ?? null;
}

export interface CurrentContact {
	id: string;
	entity_id: string;
	type: string;
	address_entity_id: string;
	metadata: Record<string, unknown>;
	photo_keys: string[];
}

/** The live version of a contact, or null when it does not exist or was deleted. */
export async function readCurrentContact(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<CurrentContact | null> {
	const result = await client.query<CurrentContact>(
		`SELECT id, entity_id, type, address_entity_id, metadata, photo_keys
		   FROM universe.org_contact
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL`,
		[entityId, orgId]
	);
	return result.rows[0] ?? null;
}
