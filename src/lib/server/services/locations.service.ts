import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { LOCATION_ROW_COLUMNS } from '$lib/server/locations';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/server/pagination';
import type { Page } from '$lib/server/pagination';

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
