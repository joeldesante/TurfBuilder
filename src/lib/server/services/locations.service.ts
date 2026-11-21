import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import Papa from 'papaparse';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import { requireLocationOrg, requireOrgPermission } from '$lib/server/list-access';
import type { AddressFields } from '$lib/schemas/address';
import type { LocationFields, LocationPatch } from '$lib/schemas/location';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';
import { editedAddress, locationToAddress } from '$lib/shared/utils/location-address';
import { logger } from '$lib/server/logger';
import { createAddressVersion, insertAddress, softDeleteAddress } from './addresses.service';
import { createContactVersion, insertContact, softDeleteContact } from './contacts.service';
import { currentAddressJoin, locationColumns } from './contact-columns';

/**
 * Locations: what the pages call a contact at its address. Every location so
 * far is a 'business' contact (`universe.org_contact`, metadata `{ name }`) at
 * a structured address (`universe.org_address`). The pages and the API keep
 * the flat location fields (`address_line_1`, `city`, ...); this service maps
 * them onto the two (see `$lib/shared/utils/location-address`).
 *
 * Contacts and addresses are versioned: an edit closes the current version and
 * inserts a successor. Lists and turfs record the contact version and the
 * address version they were made with, so nothing here touches them: an edit,
 * a move, or a deletion leaves every list and turf as it was.
 */

/** The contact type every location is, until the forms offer others. */
export const LOCATION_CONTACT_TYPE = 'business';

/** The country an address gets when nothing names one and the org has no addresses yet. */
const FALLBACK_COUNTRY = 'US';

/**
 * Ceiling on markers returned for one viewport. High enough that a city-block
 * view is complete, low enough that a zoomed-out view cannot try to serialize
 * an entire imported universe into the browser.
 */
export const MAX_VIEWPORT_LOCATIONS = 2000;

/**
 * Columns the admin list and the admin map both render, shaped to the
 * LocationRow interface the page component declares. Shared so a column added
 * for one view cannot go missing from the other.
 *
 * Expects `CURRENT_LOCATIONS_FROM`, with the org as `$1`.
 */
export const LOCATION_ROW_COLUMNS = `
	c.id, c.entity_id,
	${locationColumns('c', 'a')},
	c.photo_keys,
	ls.status AS suggestion_status`;

/** The org's current locations, tentative ones included, with the org as `$1`. */
const CURRENT_LOCATIONS_FROM = `
	FROM universe.org_contact c
	${currentAddressJoin('c', 'a')}
	LEFT JOIN universe.location_suggestion ls ON ls.entity_id = c.entity_id AND ls.org_id = c.org_id
	WHERE c.org_id = $1 AND c.valid_to IS NULL`;

// ---------------------------------------------------------------------------
// Writes, for services that hold an org transaction
// ---------------------------------------------------------------------------

/**
 * The country a new address without one gets: the most common country among
 * the org's current addresses, as the address backfill does.
 */
async function defaultCountry(client: PoolClient, orgId: string): Promise<string> {
	const result = await client.query<{ country_code: string }>(
		`SELECT country_code FROM universe.org_address
		  WHERE org_id = $1 AND valid_to IS NULL
		  GROUP BY country_code ORDER BY count(*) DESC, country_code LIMIT 1`,
		[orgId]
	);
	return result.rows[0]?.country_code ?? FALLBACK_COUNTRY;
}

export interface LocationVersion {
	entityId: string;
	/** The contact version. */
	versionId: string;
	/** The address version the contact version is at. */
	addressId: string;
}

/**
 * Creates a location: a new address and a contact at it.
 *
 * @param sourceRef recorded on the contact's entity, as imports name where a row came from
 * @param fallbackCountry the org's default country when the caller already
 *   read it (an import reads it once for all its rows); looked up otherwise,
 *   and only for a location that names no country
 */
export async function insertLocation(
	client: PoolClient,
	orgId: string,
	fields: LocationFields,
	authoredBy: string | null,
	source: string,
	sourceRef: string | null = null,
	fallbackCountry?: string
): Promise<LocationVersion> {
	// A location that names its country never uses the fallback, so the
	// aggregate behind it is not run for one.
	const country = fields.country_code?.trim()
		? FALLBACK_COUNTRY
		: (fallbackCountry ?? (await defaultCountry(client, orgId)));

	const address = await insertAddress(
		client,
		orgId,
		locationToAddress(fields, country),
		authoredBy,
		source
	);

	const entity = await client.query<{ id: string }>(
		`INSERT INTO universe.org_entity (org_id, source_ref) VALUES ($1, $2) RETURNING id`,
		[orgId, sourceRef]
	);

	const contact = await insertContact(
		client,
		orgId,
		{
			type: LOCATION_CONTACT_TYPE,
			addressEntityId: address.entityId,
			metadata: { name: fields.name ?? '' },
			photoKeys: fields.photo_keys ?? []
		},
		authoredBy,
		source,
		entity.rows[0].id
	);

	return { entityId: contact.entityId, versionId: contact.versionId, addressId: address.versionId };
}

interface LockedLocation {
	contactId: string;
	type: string;
	metadata: Record<string, unknown>;
	addressEntityId: string;
	addressId: string;
	address: AddressFields;
	fields: LocationFields;
}

/**
 * The live contact of a location and its live address, locked so a concurrent
 * edit cannot interleave between this read and the new version.
 */
async function lockLocation(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<LockedLocation | null> {
	const result = await client.query(
		`SELECT c.id AS contact_id, c.type, c.metadata, c.photo_keys,
		        a.id AS address_id, a.entity_id AS address_entity_id,
		        a.premises_name, a.premises_number, a.thoroughfare_name, a.thoroughfare_type,
		        a.thoroughfare_pre_qualifier, a.thoroughfare_post_qualifier,
		        a.dependent_locality, a.locality, a.region, a.postcode, a.country_code,
		        a.unit_type, a.unit_identifier, a.floor,
		        ${locationColumns('c', 'a')}
		   FROM universe.org_contact c
		   ${currentAddressJoin('c', 'a')}
		  WHERE c.entity_id = $1 AND c.org_id = $2 AND c.valid_to IS NULL
		  FOR UPDATE OF c, a`,
		[entityId, orgId]
	);
	const row = result.rows[0];
	if (!row) return null;

	return {
		contactId: row.contact_id,
		type: row.type,
		metadata: row.metadata,
		addressEntityId: row.address_entity_id,
		addressId: row.address_id,
		address: {
			premises_name: row.premises_name,
			premises_number: row.premises_number,
			thoroughfare_name: row.thoroughfare_name,
			thoroughfare_type: row.thoroughfare_type,
			thoroughfare_pre_qualifier: row.thoroughfare_pre_qualifier,
			thoroughfare_post_qualifier: row.thoroughfare_post_qualifier,
			dependent_locality: row.dependent_locality,
			locality: row.locality,
			region: row.region,
			postcode: row.postcode,
			country_code: row.country_code,
			unit_type: row.unit_type,
			unit_identifier: row.unit_identifier,
			floor: row.floor,
			latitude: row.latitude,
			longitude: row.longitude
		},
		fields: {
			name: row.name,
			address_line_1: row.address_line_1,
			address_line_2: row.address_line_2,
			address_line_3: null,
			city: row.city,
			state_or_region: row.state_or_region,
			postal_code: row.postal_code,
			country_code: row.country_code,
			latitude: row.latitude,
			longitude: row.longitude,
			photo_keys: row.photo_keys
		}
	};
}

/** Whether a live contact other than `entityId` is at the address. */
async function addressShared(
	client: PoolClient,
	orgId: string,
	addressEntityId: string,
	entityId: string
): Promise<boolean> {
	const result = await client.query(
		`SELECT 1 FROM universe.org_contact
		  WHERE address_entity_id = $1 AND org_id = $2 AND valid_to IS NULL AND entity_id <> $3
		  LIMIT 1`,
		[addressEntityId, orgId, entityId]
	);
	return (result.rowCount ?? 0) > 0;
}

/**
 * Makes `fields` (complete; merge a patch first with mergeLocationFields) the
 * location's new version. The address gets a new version only when its fields
 * changed; an address other contacts are also at is not moved under them, so
 * the location moves to a new address instead.
 *
 * @returns null when the location has no live version
 */
export async function createLocationVersion(
	client: PoolClient,
	orgId: string,
	entityId: string,
	fields: LocationFields,
	authoredBy: string | null,
	source: string
): Promise<(LocationVersion & { oldVersionId: string }) | null> {
	const current = await lockLocation(client, orgId, entityId);
	if (!current) return null;

	let addressEntityId = current.addressEntityId;
	let addressId = current.addressId;
	const nextAddress = editedAddress(current.address, fields);
	if (nextAddress) {
		if (await addressShared(client, orgId, current.addressEntityId, entityId)) {
			const created = await insertAddress(client, orgId, nextAddress, authoredBy, source);
			addressEntityId = created.entityId;
			addressId = created.versionId;
		} else {
			const versioned = await createAddressVersion(
				client,
				orgId,
				current.addressEntityId,
				nextAddress,
				authoredBy,
				source
			);
			addressId = versioned.newVersionId;
		}
	}

	const { oldVersionId, newVersionId } = await createContactVersion(
		client,
		orgId,
		entityId,
		{
			type: current.type,
			addressEntityId,
			metadata: { ...current.metadata, name: fields.name ?? '' },
			photoKeys: fields.photo_keys ?? []
		},
		authoredBy,
		source
	);

	return {
		entityId,
		versionId: newVersionId,
		addressId,
		oldVersionId: oldVersionId ?? current.contactId
	};
}

/** Closes the address unless a live contact is still at it. */
async function retireAddressIfUnused(
	client: PoolClient,
	orgId: string,
	addressEntityId: string
): Promise<void> {
	const used = await client.query(
		`SELECT 1 FROM universe.org_contact
		  WHERE address_entity_id = $1 AND org_id = $2 AND valid_to IS NULL LIMIT 1`,
		[addressEntityId, orgId]
	);
	if ((used.rowCount ?? 0) === 0) await softDeleteAddress(client, orgId, addressEntityId);
}

/**
 * Soft-deletes a location: its contact is closed with no successor, and its
 * address too when nothing else is at it. Every version survives, and lists,
 * turfs, and canvassing history keep the versions they recorded.
 *
 * @returns the closed contact version id, or null if the location had no live version
 */
export async function softDeleteLocation(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<string | null> {
	const current = await lockLocation(client, orgId, entityId);
	if (!current) return null;

	const closed = await softDeleteContact(client, orgId, entityId);
	await retireAddressIfUnused(client, orgId, current.addressEntityId);
	return closed;
}

/**
 * Hard-deletes a location nobody reviewed yet (a volunteer's addition): the
 * contact entity with every version, its turf door with the visit and answers
 * recorded there, and its address when nothing else refers to it.
 *
 * @returns whether there was anything to delete
 */
export async function deleteUnreviewedLocation(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<boolean> {
	const addresses = await client.query<{ address_entity_id: string }>(
		`SELECT DISTINCT address_entity_id FROM universe.org_contact WHERE entity_id = $1 AND org_id = $2`,
		[entityId, orgId]
	);

	const deleted = await client.query(
		`DELETE FROM universe.org_entity WHERE id = $1 AND org_id = $2`,
		[entityId, orgId]
	);
	if ((deleted.rowCount ?? 0) === 0) return false;

	// An address no contact, list, or turf refers to was made for this addition only.
	await client.query(
		`DELETE FROM universe.org_entity e
		  WHERE e.id = ANY($1) AND e.org_id = $2
		    AND NOT EXISTS (
		      SELECT 1 FROM universe.org_contact c
		       WHERE c.address_entity_id = e.id AND c.org_id = e.org_id)
		    AND NOT EXISTS (
		      SELECT 1 FROM universe.org_address a
		       WHERE a.entity_id = e.id AND a.org_id = e.org_id
		         AND (EXISTS (SELECT 1 FROM universe.list_entry le WHERE le.address_id = a.id)
		           OR EXISTS (SELECT 1 FROM universe.turf_location tl
		                       WHERE tl.address_id = a.id AND tl.org_id = e.org_id)))`,
		[addresses.rows.map((r) => r.address_entity_id), orgId]
	);
	return true;
}

export interface CurrentVersion extends LocationFields {
	id: string;
	entity_id: string;
}

/**
 * Reads the live version of a location as flat fields, ready to be merged
 * with a partial patch. Locks it, like the version write that follows.
 *
 * @returns null if the location does not exist in this org or has been deleted
 */
export async function readCurrentVersion(
	client: PoolClient,
	orgId: string,
	entityId: string
): Promise<CurrentVersion | null> {
	const current = await lockLocation(client, orgId, entityId);
	if (!current) return null;
	return { id: current.contactId, entity_id: entityId, ...current.fields };
}

/**
 * Merges a partial patch over a current version, producing the complete field
 * set a new version requires. Keys absent from the patch keep their current
 * value; keys explicitly set to null are cleared.
 */
export function mergeLocationFields(
	current: LocationFields,
	patch: Partial<LocationFields>
): LocationFields {
	const pick = <K extends keyof LocationFields>(key: K): LocationFields[K] =>
		patch[key] !== undefined ? (patch[key] as LocationFields[K]) : current[key];

	return {
		name: pick('name'),
		address_line_1: pick('address_line_1'),
		address_line_2: pick('address_line_2'),
		address_line_3: pick('address_line_3'),
		city: pick('city'),
		state_or_region: pick('state_or_region'),
		postal_code: pick('postal_code'),
		country_code: pick('country_code'),
		latitude: pick('latitude'),
		longitude: pick('longitude'),
		photo_keys: pick('photo_keys')
	};
}

// ---------------------------------------------------------------------------
// Canvasser corrections
//
// A canvasser cannot change the official dataset directly. A correction is
// parked in universe.location_edit_suggestion, in the flat shape the form
// sends, and becomes a new version of the location only on approval.
// ---------------------------------------------------------------------------

export interface EditTarget {
	/** The turf door the canvasser was looking at. */
	turfLocationId: string;
	orgEntityId: string;
}

/**
 * Resolves the door a canvasser is correcting, confirming it is on their turf.
 *
 * @returns the target, or null when the door is not on that turf
 */
export async function findEditTarget(
	client: PoolClient,
	turfLocationId: string,
	turfId: string,
	orgId: string
): Promise<EditTarget | null> {
	const result = await client.query<{ turf_location_id: string; org_entity_id: string }>(
		`SELECT tl.id AS turf_location_id, c.entity_id AS org_entity_id
		   FROM universe.turf_location tl
		   JOIN universe.org_contact c ON c.id = tl.contact_id AND c.org_id = tl.org_id
		  WHERE tl.id = $1 AND tl.turf_id = $2 AND tl.org_id = $3`,
		[turfLocationId, turfId, orgId]
	);

	const row = result.rows[0];
	if (!row) return null;
	return { turfLocationId: row.turf_location_id, orgEntityId: row.org_entity_id };
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
	const current = await readCurrentVersion(client, orgId, proposal.org_entity_id);
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

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
 */
export async function queryOrgLocationsPage(
	client: PoolClient,
	orgId: string,
	requested: number
): Promise<Page<OrgLocationRow>> {
	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count ${CURRENT_LOCATIONS_FROM}`,
		[orgId]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);

	// The id tiebreak makes the order total, so pages cannot repeat or skip a row.
	const rows = await client.query<OrgLocationRow>(
		`SELECT ${LOCATION_ROW_COLUMNS}
		 ${CURRENT_LOCATIONS_FROM}
		 ORDER BY name NULLS LAST, address_line_1 NULLS LAST, c.id
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

export const ViewportSchema = z.object({
	west: z.coerce.number().min(-180).max(180),
	south: z.coerce.number().min(-90).max(90),
	east: z.coerce.number().min(-180).max(180),
	north: z.coerce.number().min(-90).max(90)
});

export type Viewport = z.infer<typeof ViewportSchema>;

/**
 * Splits a viewport into the boxes PostGIS can envelope. A map panned across
 * the antimeridian reports a western edge greater than its eastern one; passed
 * to ST_MakeEnvelope as-is that describes an inside-out box and matches
 * nothing, so it becomes two boxes meeting at 180 degrees.
 */
export function envelopes(v: Viewport): [number, number, number, number][] {
	if (v.west <= v.east) return [[v.west, v.south, v.east, v.north]];
	return [
		[v.west, v.south, 180, v.north],
		[-180, v.south, v.east, v.north]
	];
}

/**
 * The org's current locations inside a map viewport, at most
 * MAX_VIEWPORT_LOCATIONS of them. 404 unless the caller is a member, 403
 * without `location.read`.
 */
export async function listLocationsInViewport(
	userId: string,
	orgId: string,
	viewport: Viewport
): Promise<{ locations: OrgLocationRow[]; truncated: boolean }> {
	await requireOrgPermission(userId, orgId, 'location.read');
	const boxes = envelopes(viewport);

	// $1 is the org, so each box's four corners start at $2.
	const predicate = boxes
		.map((_, i) => {
			const p = 2 + i * 4;
			return `a.coordinates && ST_MakeEnvelope($${p}, $${p + 1}, $${p + 2}, $${p + 3}, 4326)`;
		})
		.join(' OR ');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<OrgLocationRow>(
			`SELECT ${LOCATION_ROW_COLUMNS}
			 ${CURRENT_LOCATIONS_FROM}
			   AND (${predicate})
			 ORDER BY c.id
			 LIMIT ${MAX_VIEWPORT_LOCATIONS + 1}`,
			[orgId, ...boxes.flat()]
		);

		// One row over the cap only ever proves there are more; it is never sent.
		const truncated = result.rows.length > MAX_VIEWPORT_LOCATIONS;
		return {
			locations: truncated ? result.rows.slice(0, MAX_VIEWPORT_LOCATIONS) : result.rows,
			truncated
		};
	});
}

// ---------------------------------------------------------------------------
// Staff operations
// ---------------------------------------------------------------------------

/**
 * Creates a location, as authored from the admin map. It is live at once: no
 * suggestion is recorded, so nothing keeps it out of buckets and lists. 404
 * unless the caller is a member, 403 without `location.create`.
 */
export async function createOrgLocation(
	userId: string,
	orgId: string,
	fields: LocationFields
): Promise<{ entity_id: string; id: string }> {
	await requireOrgPermission(userId, orgId, 'location.create');

	return withOrgTransaction(orgId, async (client) => {
		const { entityId, versionId } = await insertLocation(client, orgId, fields, userId, 'manual');
		return { entity_id: entityId, id: versionId };
	});
}

/**
 * Changes the given fields of a location as a new version; fields sent as
 * null are cleared. 404 when it is in none of the caller's orgs or was
 * deleted, 403 without `location.update`.
 */
export async function updateLocation(
	userId: string,
	entityId: string,
	patch: LocationPatch
): Promise<{ entity_id: string; id: string }> {
	const orgId = await requireLocationOrg(userId, entityId);
	await requireOrgPermission(userId, orgId, 'location.update');

	return withOrgTransaction(orgId, async (client) => {
		const current = await readCurrentVersion(client, orgId, entityId);
		if (!current) throw error(404, 'Location not found');

		const version = await createLocationVersion(
			client,
			orgId,
			entityId,
			mergeLocationFields(current, patch),
			userId,
			'manual'
		);
		if (!version) throw error(404, 'Location not found');
		return { entity_id: entityId, id: version.versionId };
	});
}

/**
 * Soft-deletes a location. Its history, the lists and turfs it is on, and the
 * canvassing recorded there all stay. 404 when it is in none of the caller's
 * orgs or was already deleted, 403 without `location.delete`.
 */
export async function deleteLocation(userId: string, entityId: string): Promise<void> {
	const orgId = await requireLocationOrg(userId, entityId);
	await requireOrgPermission(userId, orgId, 'location.delete');

	await withOrgTransaction(orgId, async (client) => {
		const closed = await softDeleteLocation(client, orgId, entityId);
		if (!closed) throw error(404, 'Location not found');
	});
}

const ImportRowSchema = z.object({
	name: z.string().max(255).optional(),
	address_line_1: z.string().max(255).optional(),
	address_line_2: z.string().max(255).optional(),
	address_line_3: z.string().max(255).optional(),
	city: z.string().max(120).optional(),
	state_or_region: z.string().max(120).optional(),
	postal_code: z.string().max(20).optional(),
	country_code: z
		.string()
		.regex(/^[A-Za-z]{2}$/, 'country_code must be a 2-letter ISO code')
		.optional(),
	latitude: z.coerce
		.number({ error: 'latitude is required' })
		.min(-90, 'latitude must be between -90 and 90')
		.max(90, 'latitude must be between -90 and 90'),
	longitude: z.coerce
		.number({ error: 'longitude is required' })
		.min(-180, 'longitude must be between -180 and 180')
		.max(180, 'longitude must be between -180 and 180')
});

export interface ImportResult {
	imported: number;
	skipped: number;
	errors: { row: number; reason: string }[];
}

/**
 * Imports locations from CSV text with a header row: name, address_line_1,
 * address_line_2, city, state_or_region, postal_code, country_code, latitude,
 * longitude. Every location needs its pin, since every address has one; rows
 * without one, or with a value out of range, are skipped and reported. 404
 * unless the caller is a member, 403 without `location.create`.
 */
export async function importLocationsCsv(
	userId: string,
	orgId: string,
	text: string
): Promise<ImportResult> {
	await requireOrgPermission(userId, orgId, 'location.create');

	const candidates = Papa.parse<Record<string, unknown>>(text, {
		header: true,
		skipEmptyLines: true
	}).data;

	const errors: ImportResult['errors'] = [];
	const valid: z.infer<typeof ImportRowSchema>[] = [];
	candidates.forEach((row, i) => {
		const normalized = Object.fromEntries(
			Object.entries(row).map(([k, v]) => [
				k,
				typeof v === 'string' && v.trim() === '' ? undefined : v
			])
		);
		const parsed = ImportRowSchema.safeParse(normalized);
		if (parsed.success) valid.push(parsed.data);
		else errors.push({ row: i + 1, reason: parsed.error.issues.map((e) => e.message).join('; ') });
	});

	if (valid.length > 0) {
		const started = Date.now();
		await withOrgTransaction(orgId, async (client) => {
			// Read once for the file rather than once per row.
			const fallbackCountry = valid.some((row) => !row.country_code)
				? await defaultCountry(client, orgId)
				: undefined;

			for (const row of valid) {
				await insertLocation(
					client,
					orgId,
					{ ...row, country_code: row.country_code?.toUpperCase() ?? null, photo_keys: [] },
					userId,
					'manual_import',
					null,
					fallbackCountry
				);
			}
		});
		logger.info(
			{ organizationId: orgId, rowCount: valid.length, durationMs: Date.now() - started },
			'Location import batch written'
		);
	}

	return { imported: valid.length, skipped: candidates.length - valid.length, errors };
}

export interface LocationsOverview extends Page<OrgLocationRow> {
	/** The box around every current location, or null when there are none. */
	bounds: { west: number; south: number; east: number; north: number } | null;
}

/**
 * The data browser's opening view: one page of the org's locations and the
 * box the map should fit to. 404 unless the caller is a member, 403 without
 * `location.read`.
 */
export async function getLocationsOverview(
	userId: string,
	orgId: string,
	requested: number
): Promise<LocationsOverview> {
	await requireOrgPermission(userId, orgId, 'location.read');

	return withOrgTransaction(orgId, async (client) => {
		const page = await queryOrgLocationsPage(client, orgId, requested);
		const extent = await client.query<{
			west: number | null;
			south: number | null;
			east: number | null;
			north: number | null;
		}>(
			`SELECT ST_XMin(e.extent) AS west, ST_YMin(e.extent) AS south,
			        ST_XMax(e.extent) AS east, ST_YMax(e.extent) AS north
			   FROM (SELECT ST_Extent(a.coordinates) AS extent ${CURRENT_LOCATIONS_FROM}) e`,
			[orgId]
		);
		const box = extent.rows[0];
		return {
			...page,
			bounds:
				box?.west === null || box?.west === undefined
					? null
					: {
							west: box.west,
							south: box.south as number,
							east: box.east as number,
							north: box.north as number
						}
		};
	});
}

export interface LocationDetail {
	id: string;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	address_line_3: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	country_code: string | null;
}

/**
 * A location in a bucket, by the id of its current contact version (the id a
 * bucket's rows carry). 404 when that is not a current version in the org,
 * 403 without staff access.
 */
export async function getLocationByVersion(
	userId: string,
	orgId: string,
	versionId: string
): Promise<LocationDetail> {
	await requireOrgPermission(userId, orgId, 'system.access');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<LocationDetail>(
			`SELECT c.id, ${locationColumns('c', 'a')}, NULL::text AS address_line_3
			   FROM universe.org_contact c
			   ${currentAddressJoin('c', 'a')}
			  WHERE c.id = $1 AND c.org_id = $2 AND c.valid_to IS NULL`,
			[versionId, orgId]
		);
		if (result.rows.length === 0) throw error(404, 'Location not found');
		return result.rows[0];
	});
}
