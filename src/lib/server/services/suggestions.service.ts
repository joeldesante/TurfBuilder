import type { PoolClient } from 'pg';

/**
 * Authorization for volunteer-authored locations.
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
	userId: string
): Promise<number> {
	const result = await client.query<{ n: number }>(
		`SELECT count(*)::int AS n
		   FROM universe.location_suggestion
		  WHERE turf_id = $1 AND user_id = $2 AND status = 'tentative'`,
		[turfId, userId]
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
		`SELECT ol.id AS current_version_id, t.bounds
		   FROM universe.location_suggestion ls
		   JOIN universe.turf t
		     ON t.id = ls.turf_id AND t.org_id = ls.org_id
		   JOIN universe.turf_user tu
		     ON tu.turf_id = t.id AND tu.user_id = $3 AND tu.org_id = ls.org_id
		   JOIN universe.org_location ol
		     ON ol.entity_id = ls.entity_id AND ol.valid_to IS NULL
		  WHERE ls.entity_id = $1
		    AND ls.org_id    = $4
		    AND ls.turf_id   = $2
		    AND ls.user_id   = $3
		    AND ls.status    = 'tentative'
		    AND (t.expires_at IS NULL OR t.expires_at > now())
		  FOR UPDATE OF ol`,
		[entityId, turfId, userId, orgId]
	);
	return result.rows[0] ?? null;
}
