import type { PoolClient } from 'pg';
import type { AddressFields, UnitFields } from '$lib/schemas/address';

/**
 * Address and unit writes.
 *
 * An address is versioned like a location: universe.org_entity holds the
 * identity, universe.org_address one row per version, and the current version
 * is the one with valid_to IS NULL. An edit closes it and inserts a successor.
 * Nothing points at an address version yet, so unlike createLocationVersion
 * there is nothing to repoint.
 *
 * A unit is an entity with a single, unversioned row in
 * universe.org_address_unit. It points at the address entity, so it survives
 * address edits and always reads the address's current coordinates.
 *
 * Every function expects to run inside withOrgTransaction (RLS is forced on
 * both tables) and still filters by org_id, as every org-scoped query must.
 */

/** Column list shared by both version inserts, in parameter order. */
const VERSION_COLUMNS = `
	org_id, entity_id, premises_name, premises_number,
	thoroughfare_name, thoroughfare_type, thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
	dependent_locality, locality, region, postcode, country_code,
	coordinates, authored_by, source`;

const VERSION_VALUES = `
	$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
	ST_SetSRID(ST_MakePoint($14::float8, $15::float8), 4326),
	$16, $17`;

function versionParams(
	orgId: string,
	entityId: string,
	fields: AddressFields,
	authoredBy: string | null,
	source: string
) {
	return [
		orgId,
		entityId,
		fields.premises_name ?? null,
		fields.premises_number ?? null,
		fields.thoroughfare_name ?? null,
		fields.thoroughfare_type ?? null,
		fields.thoroughfare_pre_qualifier ?? null,
		fields.thoroughfare_post_qualifier ?? null,
		fields.dependent_locality ?? null,
		fields.locality ?? null,
		fields.region ?? null,
		fields.postcode ?? null,
		fields.country_code,
		fields.longitude,
		fields.latitude,
		authoredBy,
		source
	];
}

/**
 * Creates a new address: an identity row plus its first version. The
 * set_entity_type trigger on org_address stamps the 'address' type.
 *
 * @returns the new entity id and the id of its first version row
 */
export async function insertAddress(
	client: PoolClient,
	orgId: string,
	fields: AddressFields,
	authoredBy: string | null,
	source: string,
	sourceRef: string | null = null
): Promise<{ entityId: string; versionId: string }> {
	const entity = await client.query<{ id: string }>(
		`INSERT INTO universe.org_entity (org_id, source_ref) VALUES ($1, $2) RETURNING id`,
		[orgId, sourceRef]
	);
	const entityId = entity.rows[0].id;

	const version = await client.query<{ id: string }>(
		`INSERT INTO universe.org_address (${VERSION_COLUMNS})
		 VALUES (${VERSION_VALUES})
		 RETURNING id`,
		versionParams(orgId, entityId, fields, authoredBy, source)
	);

	return { entityId, versionId: version.rows[0].id };
}

/**
 * Closes the current version of an address and inserts a successor carrying
 * the given (complete) field set, e.g. when the pin moves.
 *
 * @returns the superseded version id (null if the address had no live
 *   version) and the new version id
 */
export async function createAddressVersion(
	client: PoolClient,
	orgId: string,
	entityId: string,
	fields: AddressFields,
	authoredBy: string | null,
	source: string
): Promise<{ oldVersionId: string | null; newVersionId: string }> {
	const previous = await client.query<{ id: string }>(
		`UPDATE universe.org_address SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
	);

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO universe.org_address (${VERSION_COLUMNS})
		 VALUES (${VERSION_VALUES})
		 RETURNING id`,
		versionParams(orgId, entityId, fields, authoredBy, source)
	);

	return { oldVersionId: previous.rows[0]?.id ?? null, newVersionId: inserted.rows[0].id };
}

/**
 * Soft-deletes an address by closing its current version with no successor,
 * and soft-deletes its live units with it. Every version row survives.
 *
 * @returns the closed version id, or null if the address had no live version
 */
export async function softDeleteAddress(
	client: PoolClient,
	orgId: string,
	entityId: string,
	deletedBy: string | null
): Promise<string | null> {
	const result = await client.query<{ id: string }>(
		`UPDATE universe.org_address SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
	);

	await client.query(
		`UPDATE universe.org_address_unit SET deleted_at = now(), deleted_by = $3
		  WHERE address_entity_id = $1 AND org_id = $2 AND deleted_at IS NULL`,
		[entityId, orgId, deletedBy]
	);

	return result.rows[0]?.id ?? null;
}

export interface CurrentAddress extends AddressFields {
	id: string;
	entity_id: string;
}

/**
 * Reads the live version of an address.
 *
 * @returns null if the address does not exist in this org or has been deleted
 */
export async function readCurrentAddress(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<CurrentAddress | null> {
	const result = await client.query<CurrentAddress>(
		`SELECT id, entity_id, premises_name, premises_number,
		        thoroughfare_name, thoroughfare_type,
		        thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
		        dependent_locality, locality, region, postcode, country_code,
		        ST_Y(coordinates) AS latitude,
		        ST_X(coordinates) AS longitude
		   FROM universe.org_address
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL`,
		[entityId, orgId]
	);
	return result.rows[0] ?? null;
}

/**
 * Splits one address into several, for example when a building is divided.
 * The old address is soft-deleted (with its units), each new address gets a
 * split_from relationship back to it so the lineage stays queryable. Units are
 * not moved; the caller adds them under the new addresses.
 *
 * @returns the new address entity ids, in the order given; null when the old
 *   address has no live version
 */
export async function splitAddress(
	client: PoolClient,
	orgId: string,
	oldEntityId: string,
	newAddresses: AddressFields[],
	authoredBy: string | null,
	source: string
): Promise<string[] | null> {
	const closed = await softDeleteAddress(client, orgId, oldEntityId, authoredBy);
	if (!closed) return null;

	const created: string[] = [];
	for (const fields of newAddresses) {
		const { entityId } = await insertAddress(client, orgId, fields, authoredBy, source);
		await insertRelationship(client, orgId, entityId, oldEntityId, 'split_from', authoredBy, source);
		created.push(entityId);
	}
	return created;
}

/**
 * Adds a unit under an address. The parent must be a live address in this
 * org; a foreign key alone cannot check that, as every entity type shares
 * org_entity.
 *
 * @returns the unit's entity id, or null when the parent is not a live address
 */
export async function addUnit(
	client: PoolClient,
	orgId: string,
	addressEntityId: string,
	fields: UnitFields
): Promise<string | null> {
	const parent = await client.query(
		`SELECT 1 FROM universe.org_address
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL`,
		[addressEntityId, orgId]
	);
	if (parent.rows.length === 0) return null;

	// A unit has no version table for the set_entity_type trigger to fire on,
	// so the type is stamped here.
	const entity = await client.query<{ id: string }>(
		`INSERT INTO universe.org_entity (org_id, type_id)
		 SELECT $1, id FROM universe.entity_type WHERE slug = 'unit'
		 RETURNING id`,
		[orgId]
	);
	const entityId = entity.rows[0].id;

	await client.query(
		`INSERT INTO universe.org_address_unit
			(entity_id, org_id, address_entity_id, unit_type, unit_identifier, floor)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[
			entityId,
			orgId,
			addressEntityId,
			fields.unit_type ?? null,
			fields.unit_identifier,
			fields.floor ?? null
		]
	);

	return entityId;
}

/** Soft-deletes a unit. @returns whether a live unit was deleted */
export async function softDeleteUnit(
	client: PoolClient,
	orgId: string,
	unitEntityId: string,
	deletedBy: string | null
): Promise<boolean> {
	const result = await client.query(
		`UPDATE universe.org_address_unit SET deleted_at = now(), deleted_by = $3
		  WHERE entity_id = $1 AND org_id = $2 AND deleted_at IS NULL`,
		[unitEntityId, orgId, deletedBy]
	);
	return (result.rowCount ?? 0) > 0;
}

export interface UnitRow {
	entity_id: string;
	unit_type: string | null;
	unit_identifier: string;
	floor: string | null;
	latitude: number;
	longitude: number;
}

/** The live units of an address, each with the address's current coordinates. */
export async function listUnits(
	client: PoolClient,
	orgId: string,
	addressEntityId: string
): Promise<UnitRow[]> {
	const result = await client.query<UnitRow>(
		`SELECT u.entity_id, u.unit_type, u.unit_identifier, u.floor,
		        ST_Y(a.coordinates) AS latitude,
		        ST_X(a.coordinates) AS longitude
		   FROM universe.org_address_unit u
		   JOIN universe.org_address a
		     ON a.entity_id = u.address_entity_id AND a.org_id = $2 AND a.valid_to IS NULL
		  WHERE u.address_entity_id = $1 AND u.org_id = $2 AND u.deleted_at IS NULL
		  ORDER BY u.unit_type NULLS FIRST, u.unit_identifier`,
		[addressEntityId, orgId]
	);
	return result.rows;
}

/**
 * Records that a location is at an address, or at a unit within one, as a
 * located_at relationship. Locations still carry their own address columns
 * until the contract step; this link is what that step will read.
 */
export async function linkLocation(
	client: PoolClient,
	orgId: string,
	locationEntityId: string,
	targetEntityId: string,
	authoredBy: string | null,
	source: string
): Promise<void> {
	await insertRelationship(
		client,
		orgId,
		locationEntityId,
		targetEntityId,
		'located_at',
		authoredBy,
		source
	);
}

async function insertRelationship(
	client: PoolClient,
	orgId: string,
	fromEntityId: string,
	toEntityId: string,
	typeSlug: string,
	authoredBy: string | null,
	source: string
): Promise<void> {
	await client.query(
		`INSERT INTO universe.org_relationship
			(org_id, from_org_entity_id, to_org_entity_id, relationship_type_id, authored_by, source)
		 SELECT $1, $2, $3, id, $5, $6 FROM universe.relationship_type WHERE slug = $4`,
		[orgId, fromEntityId, toEntityId, typeSlug, authoredBy, source]
	);
}
