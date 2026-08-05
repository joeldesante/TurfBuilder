import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { can } from '$lib/auth-helpers';

export async function load({ locals }) {
	if (!can(locals.organization, 'location', 'read')) {
		throw error(403, 'Forbidden');
	}

	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query(
			`SELECT ls.id, ls.entity_id, ls.created_at,
			        u.name AS submitted_by,
			        t.code AS turf_code,
			        ol.name, ol.address_line_1, ol.address_line_2,
			        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
			        ST_Y(ol.coordinates) AS latitude,
			        ST_X(ol.coordinates) AS longitude,
			        ol.photo_keys
			   FROM universe.location_suggestion ls
			   JOIN universe.org_location ol
			     ON ol.entity_id = ls.entity_id AND ol.valid_to IS NULL
			   LEFT JOIN auth."user" u ON u.id = ls.user_id
			   LEFT JOIN universe.turf t ON t.id = ls.turf_id
			  WHERE ls.org_id = $1 AND ls.status = 'tentative'
			  ORDER BY ls.created_at DESC`,
			[orgId]
		);

		// Corrections carry the proposed values alongside the current ones so the
		// review screen can show what would actually change.
		const edits = await client.query(
			`SELECT les.id, les.created_at, les.note, les.photo_keys,
			        u.name AS submitted_by,
			        t.code AS turf_code,
			        les.public_entity_id IS NOT NULL AS is_public_location,
			        COALESCE(cur_ol.name, cur_pl.name) AS current_name,
			        COALESCE(cur_ol.address_line_1, cur_pl.address_line_1) AS current_address_line_1,
			        COALESCE(cur_ol.address_line_2, cur_pl.address_line_2) AS current_address_line_2,
			        COALESCE(cur_ol.city, cur_pl.city) AS current_city,
			        COALESCE(cur_ol.state_or_region, cur_pl.state_or_region) AS current_state_or_region,
			        COALESCE(cur_ol.postal_code, cur_pl.postal_code) AS current_postal_code,
			        COALESCE(cur_ol.country_code, cur_pl.country_code) AS current_country_code,
			        les.name, les.address_line_1, les.address_line_2,
			        les.city, les.state_or_region, les.postal_code, les.country_code,
			        les.coordinates IS NOT NULL AS moves_pin,
			        ST_Y(les.coordinates) AS latitude,
			        ST_X(les.coordinates) AS longitude
			   FROM universe.location_edit_suggestion les
			   LEFT JOIN auth."user" u ON u.id = les.user_id
			   LEFT JOIN universe.turf t ON t.id = les.turf_id
			   LEFT JOIN universe.org_location cur_ol
			          ON cur_ol.entity_id = les.org_entity_id AND cur_ol.valid_to IS NULL
			   LEFT JOIN universe.public_location cur_pl
			          ON cur_pl.entity_id = les.public_entity_id AND cur_pl.valid_to IS NULL
			  WHERE les.org_id = $1 AND les.status = 'pending'
			  ORDER BY les.created_at DESC`,
			[orgId]
		);

		return {
			suggestions: result.rows,
			edits: edits.rows,
			canApprove: can(locals.organization, 'location', 'create'),
			canReject: can(locals.organization, 'location', 'delete'),
			canReviewEdits: can(locals.organization, 'location', 'update')
		};
	});
}
