import type { PoolClient } from 'pg';
import { createLocationVersion, insertLocation } from './locations.js';
import type { LocationFields } from '$lib/schemas/location.js';

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
	orgEntityId: string | null;
	publicLocationId: string | null;
	publicEntityId: string | null;
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
		org_entity_id: string | null;
		public_location_id: string | null;
		public_entity_id: string | null;
	}>(
		`SELECT tl.id AS turf_location_id,
		        ol.entity_id AS org_entity_id,
		        tl.public_location_id,
		        pl.entity_id AS public_entity_id
		   FROM universe.turf_location tl
		   LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
		   LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
		  WHERE tl.id = $1 AND tl.turf_id = $2 AND tl.org_id = $3`,
		[turfLocationId, turfId, orgId]
	);

	const row = result.rows[0];
	if (!row) return null;

	return {
		turfLocationId: row.turf_location_id,
		orgEntityId: row.org_entity_id,
		publicLocationId: row.public_location_id,
		publicEntityId: row.public_entity_id
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
			org_id, org_entity_id, public_entity_id, turf_id, turf_location_id, user_id,
			name, address_line_1, address_line_2, address_line_3,
			city, state_or_region, postal_code, country_code,
			coordinates, photo_keys, note
		 ) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12, $13, $14,
			CASE WHEN $15::float8 IS NULL THEN NULL
			     ELSE ST_SetSRID(ST_MakePoint($15::float8, $16::float8), 4326) END,
			$17, $18
		 )
		 RETURNING id`,
		[
			orgId,
			target.orgEntityId,
			target.orgEntityId ? null : target.publicEntityId,
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
	org_entity_id: string | null;
	public_entity_id: string | null;
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
		`SELECT id, org_entity_id, public_entity_id, turf_location_id,
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

/** Reads the live version of a public location as a field set. */
export async function readPublicLocationFields(
	client: PoolClient,
	entityId: string
): Promise<LocationFields | null> {
	const result = await client.query<LocationFields>(
		`SELECT name, address_line_1, address_line_2, address_line_3,
		        city, state_or_region, postal_code, country_code,
		        ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude,
		        ARRAY[]::text[] AS photo_keys
		   FROM universe.public_location
		  WHERE entity_id = $1 AND valid_to IS NULL`,
		[entityId]
	);
	return result.rows[0] ?? null;
}

/**
 * Applies an approved correction.
 *
 * For an org location this is an ordinary new version. For a public one it is
 * a fork: the shared pool is read-only and belongs to every org, so the
 * correction becomes an org-private copy and the turf assignment is repointed
 * onto it. Other organizations keep seeing the original.
 *
 * @returns the entity that now carries the corrected values
 */
export async function applyApprovedProposal(
	client: PoolClient,
	orgId: string,
	proposal: PendingProposal,
	reviewerId: string
): Promise<{ entityId: string; forked: boolean } | null> {
	if (proposal.org_entity_id) {
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
		return { entityId: proposal.org_entity_id, forked: false };
	}

	if (!proposal.public_entity_id) return null;

	const current = await readPublicLocationFields(client, proposal.public_entity_id);
	if (!current) return null;

	const { entityId, versionId } = await insertLocation(
		client,
		orgId,
		applyProposal(current, proposal),
		reviewerId,
		'field_correction'
	);

	// Move every assignment in this org off the shared record and onto the
	// org-private copy, so canvassers see the correction from now on.
	await client.query(
		`UPDATE universe.turf_location tl
		    SET public_location_id = NULL, org_location_id = $1
		   FROM universe.public_location pl
		  WHERE pl.id = tl.public_location_id
		    AND pl.entity_id = $2
		    AND tl.org_id = $3`,
		[versionId, proposal.public_entity_id, orgId]
	);

	return { entityId, forked: true };
}
