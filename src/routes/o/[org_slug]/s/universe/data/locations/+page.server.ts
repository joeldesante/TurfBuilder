import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { can } from '$lib/auth-helpers';

const PAGE_SIZE = 100;

export async function load({ locals }) {
	if (!can(locals.organization, 'location', 'read')) {
		throw error(403, 'Forbidden');
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		// valid_to IS NULL keeps superseded versions and soft-deleted locations
		// out of both the count and the list.
		const [countResult, rowsResult] = await Promise.all([
			client.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count
				   FROM universe.org_location
				  WHERE org_id = $1 AND valid_to IS NULL`,
				[orgId]
			),
			client.query(
				`SELECT ol.id, ol.entity_id, ol.name,
				        ol.address_line_1, ol.address_line_2,
				        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
				        ST_Y(ol.coordinates) AS latitude,
				        ST_X(ol.coordinates) AS longitude,
				        ol.photo_keys,
				        ls.status AS suggestion_status
				   FROM universe.org_location ol
				   LEFT JOIN universe.location_suggestion ls ON ls.entity_id = ol.entity_id
				  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
				  ORDER BY ol.name NULLS LAST, ol.address_line_1 NULLS LAST
				  LIMIT $2`,
				[orgId, PAGE_SIZE]
			)
		]);

		return {
			totalCount: parseInt(countResult.rows[0].count, 10),
			locations: rowsResult.rows,
			canCreate: can(locals.organization, 'location', 'create'),
			canUpdate: can(locals.organization, 'location', 'update'),
			canDelete: can(locals.organization, 'location', 'delete')
		};
	});
}
