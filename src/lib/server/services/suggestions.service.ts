import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import {
	requireLocationEditOrg,
	requireOrgPermission,
	requireSuggestionOrg
} from '$lib/server/list-access';
import { currentAddressJoin, locationColumns } from './contact-columns';
import {
	applyApprovedProposal,
	deleteUnreviewedLocation,
	findPendingProposal
} from './locations.service';

/**
 * Volunteer-authored locations: the gates on adding them, and their review by staff.
 *
 * Volunteers reach these paths with no staff role, so every gate here is
 * structural: turf membership, the turf still being open, authorship of the
 * suggestion, and the pin landing inside the turf.
 */

/** Cap on open suggestions per volunteer per turf, to blunt accidental floods. */
export const MAX_OPEN_SUGGESTIONS = 25;

export interface TurfAccess {
	id: string;
	bounds: string | null;
}

/**
 * Confirms the caller may still add to this turf: they joined it, and it has
 * not expired.
 *
 * This is the first place turf.expires_at is enforced anywhere in the
 * codebase — joining, viewing, and knocking all ignore it today.
 *
 * @returns the turf, or null when the caller has no business writing to it
 */
export async function findWritableTurf(
	client: PoolClient,
	turfId: string,
	userId: string,
	orgId: string
): Promise<TurfAccess | null> {
	const result = await client.query<TurfAccess>(
		`SELECT t.id, t.bounds
		   FROM universe.turf t
		   JOIN universe.turf_user tu
		     ON tu.turf_id = t.id AND tu.user_id = $2 AND tu.org_id = $3
		  WHERE t.id = $1
		    AND t.org_id = $3
		    AND (t.expires_at IS NULL OR t.expires_at > now())`,
		[turfId, userId, orgId]
	);
	return result.rows[0] ?? null;
}

/**
 * Checks the pin falls inside the turf the volunteer is canvassing.
 *
 * Without this a volunteer could drop pins anywhere on earth into the org's
 * dataset. A turf with no bounds recorded cannot be checked, so it passes.
 */
export async function isInsideTurf(
	client: PoolClient,
	turfId: string,
	orgId: string,
	latitude: number,
	longitude: number
): Promise<boolean> {
	const result = await client.query<{ inside: boolean | null }>(
		`SELECT ST_Contains(t.bounds, ST_SetSRID(ST_MakePoint($3::float8, $4::float8), 4326)) AS inside
		   FROM universe.turf t
		  WHERE t.id = $1 AND t.org_id = $2`,
		[turfId, orgId, longitude, latitude]
	);
	const inside = result.rows[0]?.inside;
	return inside === null || inside === undefined ? true : inside;
}

/** Counts a volunteer's still-open suggestions on a turf. */
export async function countOpenSuggestions(
	client: PoolClient,
	turfId: string,
	userId: string,
	orgId: string
): Promise<number> {
	const result = await client.query<{ n: number }>(
		`SELECT count(*)::int AS n
		   FROM universe.location_suggestion
		  WHERE turf_id = $1 AND user_id = $2 AND org_id = $3 AND status = 'tentative'`,
		[turfId, userId, orgId]
	);
	return result.rows[0]?.n ?? 0;
}

export interface EditableSuggestion {
	current_version_id: string;
	bounds: string | null;
}

/**
 * Resolves a suggestion the volunteer is still allowed to change.
 *
 * All four conditions have to hold: they authored it, it has not been approved
 * yet, the turf has not expired, and they are still assigned to that turf.
 * Once an organizer approves it, or the canvassing window closes, the
 * volunteer loses the handle and this returns null.
 *
 * @returns the live version row id and turf bounds, or null when locked
 */
export async function findEditableSuggestion(
	client: PoolClient,
	entityId: string,
	turfId: string,
	userId: string,
	orgId: string
): Promise<EditableSuggestion | null> {
	const result = await client.query<EditableSuggestion>(
		`SELECT c.id AS current_version_id, t.bounds
		   FROM universe.location_suggestion ls
		   JOIN universe.turf t
		     ON t.id = ls.turf_id AND t.org_id = ls.org_id
		   JOIN universe.turf_user tu
		     ON tu.turf_id = t.id AND tu.user_id = $3 AND tu.org_id = ls.org_id
		   JOIN universe.org_contact c
		     ON c.entity_id = ls.entity_id AND c.org_id = ls.org_id AND c.valid_to IS NULL
		  WHERE ls.entity_id = $1
		    AND ls.org_id    = $4
		    AND ls.turf_id   = $2
		    AND ls.user_id   = $3
		    AND ls.status    = 'tentative'
		    AND (t.expires_at IS NULL OR t.expires_at > now())
		  FOR UPDATE OF c`,
		[entityId, turfId, userId, orgId]
	);
	return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Review by staff
// ---------------------------------------------------------------------------

export interface PendingSuggestion {
	id: string;
	entity_id: string;
	created_at: string;
	submitted_by: string | null;
	turf_code: string | null;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	country_code: string | null;
	latitude: number;
	longitude: number;
	photo_keys: string[];
}

export interface PendingEdit {
	id: string;
	created_at: string;
	note: string | null;
	photo_keys: string[];
	submitted_by: string | null;
	turf_code: string | null;
	current_name: string | null;
	current_address_line_1: string | null;
	current_address_line_2: string | null;
	current_city: string | null;
	current_state_or_region: string | null;
	current_postal_code: string | null;
	current_country_code: string | null;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	country_code: string | null;
	moves_pin: boolean;
	latitude: number | null;
	longitude: number | null;
}

/**
 * The volunteers' additions and corrections waiting for review, newest first.
 * Corrections carry the location's current values beside the proposed ones so
 * the review screen can show what would change. 404 unless the caller is a
 * member, 403 without `location.read`.
 */
export async function listPendingReviews(
	userId: string,
	orgId: string
): Promise<{ suggestions: PendingSuggestion[]; edits: PendingEdit[] }> {
	await requireOrgPermission(userId, orgId, 'location.read');

	return withOrgTransaction(orgId, async (client) => {
		const suggestions = await client.query<PendingSuggestion>(
			`SELECT ls.id, ls.entity_id, ls.created_at,
			        u.name AS submitted_by,
			        t.code AS turf_code,
			        ${locationColumns('c', 'a')},
			        c.photo_keys
			   FROM universe.location_suggestion ls
			   JOIN universe.org_contact c
			     ON c.entity_id = ls.entity_id AND c.org_id = ls.org_id AND c.valid_to IS NULL
			   ${currentAddressJoin('c', 'a')}
			   LEFT JOIN auth."user" u ON u.id = ls.user_id
			   LEFT JOIN universe.turf t ON t.id = ls.turf_id AND t.org_id = ls.org_id
			  WHERE ls.org_id = $1 AND ls.status = 'tentative'
			  ORDER BY ls.created_at DESC`,
			[orgId]
		);

		const edits = await client.query<PendingEdit>(
			`SELECT les.id, les.created_at, les.note, les.photo_keys,
			        u.name AS submitted_by,
			        t.code AS turf_code,
			        cur.name AS current_name,
			        cur.address_line_1 AS current_address_line_1,
			        cur.address_line_2 AS current_address_line_2,
			        cur.city AS current_city,
			        cur.state_or_region AS current_state_or_region,
			        cur.postal_code AS current_postal_code,
			        cur.country_code AS current_country_code,
			        les.name, les.address_line_1, les.address_line_2,
			        les.city, les.state_or_region, les.postal_code, les.country_code,
			        les.coordinates IS NOT NULL AS moves_pin,
			        ST_Y(les.coordinates) AS latitude,
			        ST_X(les.coordinates) AS longitude
			   FROM universe.location_edit_suggestion les
			   LEFT JOIN auth."user" u ON u.id = les.user_id
			   LEFT JOIN universe.turf t ON t.id = les.turf_id AND t.org_id = les.org_id
			   LEFT JOIN LATERAL (
			     SELECT ${locationColumns('c', 'a')}
			       FROM universe.org_contact c
			       ${currentAddressJoin('c', 'a')}
			      WHERE c.entity_id = les.org_entity_id AND c.org_id = les.org_id AND c.valid_to IS NULL
			   ) cur ON true
			  WHERE les.org_id = $1 AND les.status = 'pending'
			  ORDER BY les.created_at DESC`,
			[orgId]
		);

		return { suggestions: suggestions.rows, edits: edits.rows };
	});
}

/**
 * Accepts a volunteer's addition. Its turf door exists already, and once it
 * is no longer tentative it joins buckets and future lists. Lists already made
 * are snapshots, so they do not gain it. 404 when it is in none of the
 * caller's orgs, 403 without `location.create`, 409 once reviewed.
 */
export async function approveSuggestion(
	userId: string,
	suggestionId: string
): Promise<{ entity_id: string }> {
	const orgId = await requireSuggestionOrg(userId, suggestionId);
	await requireOrgPermission(userId, orgId, 'location.create');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<{ entity_id: string }>(
			`UPDATE universe.location_suggestion
			    SET status = 'approved', reviewed_by = $1, reviewed_at = now(), updated_at = now()
			  WHERE id = $2 AND org_id = $3 AND status = 'tentative'
			  RETURNING entity_id`,
			[userId, suggestionId, orgId]
		);
		if (result.rows.length === 0) throw error(409, 'This suggestion has already been reviewed.');
		return { entity_id: result.rows[0].entity_id };
	});
}

/**
 * Rejects a volunteer's addition and removes it with everything recorded
 * against it. An approved location cannot be removed this way. 404 when it is
 * in none of the caller's orgs, 403 without `location.delete`, 409 once reviewed.
 */
export async function rejectSuggestion(userId: string, suggestionId: string): Promise<void> {
	const orgId = await requireSuggestionOrg(userId, suggestionId);
	await requireOrgPermission(userId, orgId, 'location.delete');

	await withOrgTransaction(orgId, async (client) => {
		const pending = await client.query<{ entity_id: string }>(
			`SELECT entity_id FROM universe.location_suggestion
			  WHERE id = $1 AND org_id = $2 AND status = 'tentative'
			  FOR UPDATE`,
			[suggestionId, orgId]
		);
		const entityId = pending.rows[0]?.entity_id;
		if (!entityId || !(await deleteUnreviewedLocation(client, orgId, entityId))) {
			throw error(409, 'This suggestion has already been reviewed.');
		}
	});
}

/**
 * Applies a canvasser's correction as a new version of the location. 404 when
 * it is in none of the caller's orgs, 403 without `location.update`, 409 once
 * reviewed or when the location is gone.
 */
export async function approveLocationEdit(
	userId: string,
	editId: string
): Promise<{ entity_id: string }> {
	const orgId = await requireLocationEditOrg(userId, editId);
	await requireOrgPermission(userId, orgId, 'location.update');

	return withOrgTransaction(orgId, async (client) => {
		const proposal = await findPendingProposal(client, editId, orgId);
		if (!proposal) throw error(409, 'This correction has already been reviewed.');

		const applied = await applyApprovedProposal(client, orgId, proposal, userId);
		if (!applied) throw error(409, 'The location this refers to no longer exists.');

		await client.query(
			`UPDATE universe.location_edit_suggestion
			    SET status = 'approved', reviewed_by = $1, reviewed_at = now(), updated_at = now()
			  WHERE id = $2 AND org_id = $3`,
			[userId, editId, orgId]
		);
		return { entity_id: applied.entityId };
	});
}

/**
 * Declines a canvasser's correction. It is kept, marked rejected, as the
 * record of what was reported. 404 when it is in none of the caller's orgs,
 * 403 without `location.update`, 409 once reviewed.
 */
export async function rejectLocationEdit(userId: string, editId: string): Promise<void> {
	const orgId = await requireLocationEditOrg(userId, editId);
	await requireOrgPermission(userId, orgId, 'location.update');

	await withOrgTransaction(orgId, async (client) => {
		const result = await client.query(
			`UPDATE universe.location_edit_suggestion
			    SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), updated_at = now()
			  WHERE id = $2 AND org_id = $3 AND status = 'pending'`,
			[userId, editId, orgId]
		);
		if (result.rowCount === 0) throw error(409, 'This correction has already been reviewed.');
	});
}
