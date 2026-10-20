import type { PoolClient } from 'pg';
import type { AddressFields } from '$lib/schemas/address';

/**
 * Address writes.
 *
 * An address is versioned like a location: universe.org_entity holds the
 * identity, universe.org_address one row per version, and the current version
 * is the one with valid_to IS NULL. An edit closes it and inserts a successor.
 * Nothing points at an address version yet, so unlike createLocationVersion
 * there is nothing to repoint.
 *
 * A unit (apartment, suite, floor) is an address of its own, with the unit
 * fields set and its own point.
 *
 * Every function expects to run inside withOrgTransaction (RLS is forced) and
 * still filters by org_id, as every org-scoped query must.
 */

/** Column list shared by both version inserts, in parameter order. */
const VERSION_COLUMNS = `
	org_id, entity_id, premises_name, premises_number,
	thoroughfare_name, thoroughfare_type, thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
	dependent_locality, locality, region, postcode, country_code,
	unit_type, unit_identifier, floor,
	coordinates, authored_by, source`;

const VERSION_VALUES = `
	$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
	ST_SetSRID(ST_MakePoint($17::float8, $18::float8), 4326),
	$19, $20`;

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
		fields.unit_type ?? null,
		fields.unit_identifier ?? null,
		fields.floor ?? null,
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
 * Soft-deletes an address by closing its current version with no successor.
 * Every version row survives.
 *
 * @returns the closed version id, or null if the address had no live version
 */
export async function softDeleteAddress(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<string | null> {
	const result = await client.query<{ id: string }>(
		`UPDATE universe.org_address SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
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
		        unit_type, unit_identifier, floor,
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
 * The old address is soft-deleted, and each new address gets a split_from
 * relationship back to it so the lineage stays queryable.
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
	const closed = await softDeleteAddress(client, orgId, oldEntityId);
	if (!closed) return null;

	const created: string[] = [];
	for (const fields of newAddresses) {
		const { entityId } = await insertAddress(client, orgId, fields, authoredBy, source);
		await insertRelationship(client, orgId, entityId, oldEntityId, 'split_from', authoredBy, source);
		created.push(entityId);
	}
	return created;
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
