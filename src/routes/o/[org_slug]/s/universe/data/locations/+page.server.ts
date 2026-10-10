import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { can } from '$lib/auth-helpers';
import { requestedPage } from '$lib/server/pagination';
import { queryOrgLocationsPage } from '$lib/server/services/locations.service';

export async function load({ locals, url }) {
	if (!can(locals.organization, 'location', 'read')) {
		throw error(403, 'Forbidden');
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		// valid_to IS NULL keeps superseded versions and soft-deleted locations
		// out of the map's opening viewport, as it does for the page.
		const [result, extentResult] = await Promise.all([
			queryOrgLocationsPage(client, orgId, requestedPage(url)),
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

		const extent = extentResult.rows[0];

		return {
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize,
			locations: result.items,
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
