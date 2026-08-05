import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { can } from '$lib/auth-helpers';
import { LOCATION_ROW_COLUMNS } from '$lib/server/locations';

const PAGE_SIZE = 100;

export async function load({ locals, url }) {
	if (!can(locals.organization, 'location', 'read')) {
		throw error(403, 'Forbidden');
	}

	const orgId = locals.organization!.id;
	const requestedPage = Number(url.searchParams.get('page'));

	return withOrgTransaction(orgId, async (client) => {
		// valid_to IS NULL keeps superseded versions and soft-deleted locations
		// out of the count, the list, and the map's opening viewport.
		const [countResult, extentResult] = await Promise.all([
			client.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count
				   FROM universe.org_location
				  WHERE org_id = $1 AND valid_to IS NULL`,
				[orgId]
			),
			client.query<{
				west: number | null;
				south: number | null;
				east: number | null;
				north: number | null;
			}>(
				`SELECT ST_XMin(extent) AS west, ST_YMin(extent) AS south,
				        ST_XMax(extent) AS east, ST_YMax(extent) AS north
				   FROM (
				     SELECT ST_Extent(coordinates) AS extent
				       FROM universe.org_location
				      WHERE org_id = $1 AND valid_to IS NULL
				   ) e`,
				[orgId]
			)
		]);

		const totalCount = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

		// Clamped rather than 404'd: a stale ?page= from a bookmark or a deletion
		// that shortened the list should land on real rows, not an error.
		const page = Number.isFinite(requestedPage)
			? Math.min(Math.max(Math.trunc(requestedPage), 1), totalPages)
			: 1;

		const rowsResult = await client.query(
			`SELECT ${LOCATION_ROW_COLUMNS}
			   FROM universe.org_location ol
			   LEFT JOIN universe.location_suggestion ls ON ls.entity_id = ol.entity_id
			  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
			  ORDER BY ol.name NULLS LAST, ol.address_line_1 NULLS LAST, ol.id
			  LIMIT $2 OFFSET $3`,
			[orgId, PAGE_SIZE, (page - 1) * PAGE_SIZE]
		);

		const extent = extentResult.rows[0];

		return {
			totalCount,
			page,
			pageSize: PAGE_SIZE,
			locations: rowsResult.rows,
			// Null when the org has no located records, which leaves the map on its
			// own default view rather than fitting to nothing.
			initialBounds:
				extent?.west === null || extent?.west === undefined
					? null
					: {
							west: extent.west,
							south: extent.south as number,
							east: extent.east as number,
							north: extent.north as number
						},
			canCreate: can(locals.organization, 'location', 'create'),
			canUpdate: can(locals.organization, 'location', 'update'),
			canDelete: can(locals.organization, 'location', 'delete')
		};
	});
}
