import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import type { LocationFields } from '$lib/schemas/location';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';

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

/**
 * Ceiling on markers returned for one viewport. High enough that a city-block
 * view is complete, low enough that a zoomed-out view cannot try to serialize
 * an entire imported universe into the browser.
 */
export const MAX_VIEWPORT_LOCATIONS = 2000;

/**
 * Columns the admin list and the admin map both render, shaped to the
 * LocationRow interface the page component declares. Shared so a column added
 * for one view cannot go missing from the other, which is how the map ended up
 * drawing a different set of locations than the list.
 *
 * Expects `universe.org_location ol` LEFT JOINed to
 * `universe.location_suggestion ls` on entity_id.
 */
export const LOCATION_ROW_COLUMNS = `
	ol.id, ol.entity_id, ol.name,
	ol.address_line_1, ol.address_line_2,
	ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
	ST_Y(ol.coordinates) AS latitude,
	ST_X(ol.coordinates) AS longitude,
	ol.photo_keys,
	ls.status AS suggestion_status`;

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

/**
 * Canvasser-proposed corrections to locations that already exist.
 *
 * These cannot be written straight into the location: doing so would change
 * the official dataset before anyone checked it. The proposal is parked in
 * universe.location_edit_suggestion and only applied on approval, which is
 * what separates this from the volunteer-addition flow where the location row
 * itself is the proposal.
 */

export interface EditTarget {
	/** The turf assignment the canvasser was looking at. */
	turfLocationId: string;
	orgEntityId: string;
}

/**
 * Resolves the door a canvasser is correcting, confirming it belongs to the
 * turf they are assigned to.
 *
 * @returns the target, or null when the door is not on that turf
 */
export async function findEditTarget(
	client: PoolClient,
	turfLocationId: string,
	turfId: string,
	orgId: string
): Promise<EditTarget | null> {
	const result = await client.query<{
		turf_location_id: string;
		org_entity_id: string;
	}>(
		`SELECT tl.id AS turf_location_id,
		        ol.entity_id AS org_entity_id
		   FROM universe.turf_location tl
		   JOIN universe.org_location ol ON ol.id = tl.org_location_id
		  WHERE tl.id = $1 AND tl.turf_id = $2 AND tl.org_id = $3`,
		[turfLocationId, turfId, orgId]
	);

	const row = result.rows[0];
	if (!row) return null;

	return {
		turfLocationId: row.turf_location_id,
		orgEntityId: row.org_entity_id
	};
}

export interface ProposalFields {
	name?: string | null;
	address_line_1?: string | null;
	address_line_2?: string | null;
	address_line_3?: string | null;
	city?: string | null;
	state_or_region?: string | null;
	postal_code?: string | null;
	country_code?: string | null;
	latitude?: number;
	longitude?: number;
	photo_keys?: string[];
	note?: string | null;
}

/** Records a proposed correction for an organizer to review. */
export async function insertEditProposal(
	client: PoolClient,
	orgId: string,
	target: EditTarget,
	turfId: string,
	userId: string,
	fields: ProposalFields
): Promise<string> {
	const result = await client.query<{ id: string }>(
		`INSERT INTO universe.location_edit_suggestion (
			org_id, org_entity_id, turf_id, turf_location_id, user_id,
			name, address_line_1, address_line_2, address_line_3,
			city, state_or_region, postal_code, country_code,
			coordinates, photo_keys, note
		 ) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11, $12, $13,
			CASE WHEN $14::float8 IS NULL THEN NULL
			     ELSE ST_SetSRID(ST_MakePoint($14::float8, $15::float8), 4326) END,
			$16, $17
		 )
		 RETURNING id`,
		[
			orgId,
			target.orgEntityId,
			turfId,
			target.turfLocationId,
			userId,
			fields.name ?? null,
			fields.address_line_1 ?? null,
			fields.address_line_2 ?? null,
			fields.address_line_3 ?? null,
			fields.city ?? null,
			fields.state_or_region ?? null,
			fields.postal_code ?? null,
			fields.country_code ?? null,
			fields.longitude ?? null,
			fields.latitude ?? null,
			fields.photo_keys ?? [],
			fields.note ?? null
		]
	);
	return result.rows[0].id;
}

export interface PendingProposal {
	id: string;
	org_entity_id: string;
	turf_location_id: string | null;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	address_line_3: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	country_code: string | null;
	latitude: number | null;
	longitude: number | null;
	photo_keys: string[];
}

/** Loads a proposal that is still awaiting review, locking it. */
export async function findPendingProposal(
	client: PoolClient,
	proposalId: string,
	orgId: string
): Promise<PendingProposal | null> {
	const result = await client.query<PendingProposal>(
		`SELECT id, org_entity_id, turf_location_id,
		        name, address_line_1, address_line_2, address_line_3,
		        city, state_or_region, postal_code, country_code,
		        ST_Y(coordinates) AS latitude,
		        ST_X(coordinates) AS longitude,
		        photo_keys
		   FROM universe.location_edit_suggestion
		  WHERE id = $1 AND org_id = $2 AND status = 'pending'
		  FOR UPDATE`,
		[proposalId, orgId]
	);
	return result.rows[0] ?? null;
}

/**
 * Overlays a proposal onto the location's current values.
 *
 * Only fields the canvasser actually filled in are applied; a null in the
 * proposal means "not proposed", not "clear this field". That does mean a
 * correction cannot blank a field, which is the right trade for a form filled
 * in on a phone on a doorstep.
 */
export function applyProposal(current: LocationFields, proposal: PendingProposal): LocationFields {
	const pick = <T>(proposed: T | null, currentValue: T): T =>
		proposed === null || proposed === undefined ? currentValue : proposed;

	return {
		name: pick(proposal.name, current.name ?? null),
		address_line_1: pick(proposal.address_line_1, current.address_line_1 ?? null),
		address_line_2: pick(proposal.address_line_2, current.address_line_2 ?? null),
		address_line_3: pick(proposal.address_line_3, current.address_line_3 ?? null),
		city: pick(proposal.city, current.city ?? null),
		state_or_region: pick(proposal.state_or_region, current.state_or_region ?? null),
		postal_code: pick(proposal.postal_code, current.postal_code ?? null),
		country_code: pick(proposal.country_code, current.country_code ?? null),
		latitude: pick(proposal.latitude, current.latitude),
		longitude: pick(proposal.longitude, current.longitude),
		// Evidence photos stay on the proposal rather than being merged in. They
		// document the report, not the location, and appending them could push
		// the record past the three-photo cap that the forms and the API both
		// enforce, which would leave the location uneditable. The proposal row
		// is kept after approval, so the evidence stays reachable.
		photo_keys: current.photo_keys ?? []
	};
}

/** Reads the live version of an org location as a field set. */
export async function readOrgLocationFields(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<LocationFields | null> {
	const result = await client.query<LocationFields>(
		`SELECT name, address_line_1, address_line_2, address_line_3,
		        city, state_or_region, postal_code, country_code,
		        ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude,
		        photo_keys
		   FROM universe.org_location
		  WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL
		  FOR UPDATE`,
		[entityId, orgId]
	);
	return result.rows[0] ?? null;
}

/**
 * Applies an approved correction as a new version of the location, so the
 * values it replaces stay recoverable.
 *
 * @returns the entity that now carries the corrected values, or null when the
 *   location no longer has a live version
 */
export async function applyApprovedProposal(
	client: PoolClient,
	orgId: string,
	proposal: PendingProposal,
	reviewerId: string
): Promise<{ entityId: string } | null> {
	const current = await readOrgLocationFields(client, orgId, proposal.org_entity_id);
	if (!current) return null;

	await createLocationVersion(
		client,
		orgId,
		proposal.org_entity_id,
		applyProposal(current, proposal),
		reviewerId,
		'field_correction'
	);
	return { entityId: proposal.org_entity_id };
}

export interface OrgLocationRow {
	id: string;
	entity_id: string;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	country_code: string | null;
	latitude: number | null;
	longitude: number | null;
	photo_keys: string[];
	suggestion_status: 'tentative' | 'approved' | null;
}

/**
 * One alphabetical page of the org's current locations. For callers that
 * already hold an org transaction and have checked `location.read`.
 *
 * valid_to IS NULL keeps superseded versions and soft-deleted locations out of
 * the count and the page.
 */
export async function queryOrgLocationsPage(
	client: PoolClient,
	orgId: string,
	requested: number
): Promise<Page<OrgLocationRow>> {
	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count
		   FROM universe.org_location
		  WHERE org_id = $1 AND valid_to IS NULL`,
		[orgId]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);

	// The id tiebreak makes the order total, so pages cannot repeat or skip a row.
	const rows = await client.query<OrgLocationRow>(
		`SELECT ${LOCATION_ROW_COLUMNS}
		   FROM universe.org_location ol
		   LEFT JOIN universe.location_suggestion ls ON ls.entity_id = ol.entity_id
		  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
		  ORDER BY ol.name NULLS LAST, ol.address_line_1 NULLS LAST, ol.id
		  LIMIT $2 OFFSET $3`,
		[orgId, PAGE_SIZE, pageOffset(page)]
	);

	return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
}

/** One page of the org's locations. 404 unless the caller is a member, 403 without `location.read`. */
export async function listOrgLocations(
	userId: string,
	orgId: string,
	requested: number
): Promise<Page<OrgLocationRow>> {
	await requireOrgPermission(userId, orgId, 'location.read');

	return withOrgTransaction(orgId, (client) => queryOrgLocationsPage(client, orgId, requested));
}
