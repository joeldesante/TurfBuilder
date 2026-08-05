import type { PoolClient } from 'pg';
import type { LocationFields } from '$lib/schemas/location';

/**
 * Location writes for the versioned universe model.
 *
 * A location has two tables behind it: universe.org_entity holds the stable
 * identity, universe.org_location holds one row per version. The current
 * version is the row with valid_to IS NULL; editing closes it and inserts a
 * successor, so nothing is ever destroyed.
 *
 * The catch is that universe.turf_location.org_location_id and
 * universe.list_entry.record_id both reference a *version row id*, not an
 * entity id. Left alone they would keep pointing at the superseded row, so a
 * turf would show a location's old name and old coordinates forever. Every
 * version write therefore has to repoint them, which is why all of it lives
 * behind createLocationVersion rather than being inlined into handlers.
 */

/** Column list shared by both insert paths, in parameter order. */
const VERSION_COLUMNS = `
	org_id, entity_id, name, address_line_1, address_line_2, address_line_3,
	city, state_or_region, postal_code, country_code, coordinates,
	photo_keys, authored_by, source`;

const VERSION_VALUES = `
	$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
	ST_SetSRID(ST_MakePoint($11::float8, $12::float8), 4326),
	$13, $14, $15`;

function versionParams(
	orgId: string,
	entityId: string,
	fields: LocationFields,
	authoredBy: string | null,
	source: string
) {
	return [
		orgId,
		entityId,
		fields.name ?? null,
		fields.address_line_1 ?? null,
		fields.address_line_2 ?? null,
		fields.address_line_3 ?? null,
		fields.city ?? null,
		fields.state_or_region ?? null,
		fields.postal_code ?? null,
		fields.country_code ?? null,
		fields.longitude,
		fields.latitude,
		fields.photo_keys ?? [],
		authoredBy,
		source
	];
}

/**
 * Creates a brand new location: an identity row plus its first version.
 *
 * The BEFORE INSERT set_entity_type trigger on org_location stamps the
 * 'location' type onto the entity, so type_id is left to it here.
 *
 * @returns the new entity id and the id of its first version row
 */
export async function insertLocation(
	client: PoolClient,
	orgId: string,
	fields: LocationFields,
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
		`INSERT INTO universe.org_location (${VERSION_COLUMNS})
		 VALUES (${VERSION_VALUES})
		 RETURNING id`,
		versionParams(orgId, entityId, fields, authoredBy, source)
	);

	return { entityId, versionId: version.rows[0].id };
}

/**
 * Closes the current version of a location and inserts a successor carrying
 * the given fields, then repoints everything that referenced the old version
 * row so downstream reads follow the edit.
 *
 * Callers must pass a complete field set. A partial patch has to be merged
 * over the current version first — see readCurrentVersion.
 *
 * @returns the superseded version id (null if the location had no live
 *   version) and the new version id
 */
export async function createLocationVersion(
	client: PoolClient,
	orgId: string,
	entityId: string,
	fields: LocationFields,
	authoredBy: string | null,
	source: string
): Promise<{ oldVersionId: string | null; newVersionId: string }> {
	const previous = await client.query<{ id: string }>(
		`UPDATE universe.org_location SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
	);
	const oldVersionId = previous.rows[0]?.id ?? null;

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO universe.org_location (${VERSION_COLUMNS})
		 VALUES (${VERSION_VALUES})
		 RETURNING id`,
		versionParams(orgId, entityId, fields, authoredBy, source)
	);
	const newVersionId = inserted.rows[0].id;

	if (oldVersionId) {
		await repointToVersion(client, orgId, oldVersionId, newVersionId);
	}

	return { oldVersionId, newVersionId };
}

/**
 * Moves the two version-row references from a superseded org_location row to
 * its successor.
 *
 * turf_location keeps a turf's doors pointing at live data. list_entry is
 * repointed too: list membership stays frozen (no entity joins or leaves), but
 * the pointer follows the entity's current version so list maps and future
 * turf cuts read current coordinates rather than the ones captured at snapshot
 * time.
 */
async function repointToVersion(
	client: PoolClient,
	orgId: string,
	oldVersionId: string,
	newVersionId: string
): Promise<void> {
	await client.query(
		`UPDATE universe.turf_location SET org_location_id = $1
		  WHERE org_location_id = $2 AND org_id = $3`,
		[newVersionId, oldVersionId, orgId]
	);

	// universe.list_entry has no org_id column and no RLS policy, so the join
	// to universe.list is the only tenant boundary available here. A bare
	// WHERE record_id = $2 would reach across organizations.
	await client.query(
		`UPDATE universe.list_entry le SET record_id = $1
		   FROM universe.list l
		  WHERE l.id = le.list_id
		    AND l.org_id = $3
		    AND le.record_source = 'org_location'
		    AND le.record_id = $2`,
		[newVersionId, oldVersionId, orgId]
	);
}

/**
 * Soft-deletes a location by closing its current version without inserting a
 * successor. Every historical version row survives.
 *
 * turf_location rows are deliberately left in place: turf_location_attempt and
 * survey_question_response cascade off them, and deleting the row would
 * destroy canvassing history that reporting still needs. Visibility is handled
 * at read time instead, by filtering on valid_to in the operational queries.
 *
 * @returns the closed version id, or null if the location had no live version
 */
export async function softDeleteLocation(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<string | null> {
	const result = await client.query<{ id: string }>(
		`UPDATE universe.org_location SET valid_to = now()
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  RETURNING id`,
		[entityId, orgId]
	);
	return result.rows[0]?.id ?? null;
}

export interface CurrentVersion extends LocationFields {
	id: string;
	entity_id: string;
}

/**
 * Reads the live version of a location as a LocationFields-shaped record,
 * ready to be merged with a partial patch. Takes a row lock so a concurrent
 * edit cannot interleave between the read and the version insert.
 *
 * @returns null if the entity does not exist in this org or has been deleted
 */
export async function readCurrentVersion(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<CurrentVersion | null> {
	const result = await client.query<CurrentVersion>(
		`SELECT ol.id, ol.entity_id, ol.name,
		        ol.address_line_1, ol.address_line_2, ol.address_line_3,
		        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
		        ST_Y(ol.coordinates) AS latitude,
		        ST_X(ol.coordinates) AS longitude,
		        ol.photo_keys
		   FROM universe.org_location ol
		  WHERE ol.entity_id = $1 AND ol.org_id = $2 AND ol.valid_to IS NULL
		  FOR UPDATE`,
		[entityId, orgId]
	);
	return result.rows[0] ?? null;
}

/**
 * Merges a partial patch over a current version, producing the complete field
 * set a new version row requires. Keys absent from the patch keep their
 * current value; keys explicitly set to null are cleared.
 */
export function mergeLocationFields(
	current: CurrentVersion,
	patch: Partial<LocationFields>
): LocationFields {
	return {
		name: patch.name !== undefined ? patch.name : current.name,
		address_line_1:
			patch.address_line_1 !== undefined ? patch.address_line_1 : current.address_line_1,
		address_line_2:
			patch.address_line_2 !== undefined ? patch.address_line_2 : current.address_line_2,
		address_line_3:
			patch.address_line_3 !== undefined ? patch.address_line_3 : current.address_line_3,
		city: patch.city !== undefined ? patch.city : current.city,
		state_or_region:
			patch.state_or_region !== undefined ? patch.state_or_region : current.state_or_region,
		postal_code: patch.postal_code !== undefined ? patch.postal_code : current.postal_code,
		country_code: patch.country_code !== undefined ? patch.country_code : current.country_code,
		latitude: patch.latitude !== undefined ? patch.latitude : current.latitude,
		longitude: patch.longitude !== undefined ? patch.longitude : current.longitude,
		photo_keys: patch.photo_keys !== undefined ? patch.photo_keys : current.photo_keys
	};
}
