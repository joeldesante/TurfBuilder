import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import type { LocationDetail } from '$pages/universe/buckets/locations/LocationDetailPage.svelte';

export async function load({ params, locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query<LocationDetail>(
			`SELECT
				pl.id,
				pl.name,
				pl.address_line_1,
				pl.address_line_2,
				pl.address_line_3,
				pl.city,
				pl.state_or_region,
				pl.postal_code,
				pl.country_code,
				'public'::text AS source
			FROM universe.public_location pl
			WHERE pl.id = $1
			  AND pl.valid_to IS NULL

			UNION ALL

			SELECT
				ol.id,
				ol.name,
				ol.address_line_1,
				ol.address_line_2,
				ol.address_line_3,
				ol.city,
				ol.state_or_region,
				ol.postal_code,
				ol.country_code,
				'org'::text AS source
			FROM universe.org_location ol
			WHERE ol.id = $1
			  AND ol.org_id = $2
			  AND ol.valid_to IS NULL

			LIMIT 1`,
			[params.id, locals.organization!.id]
		);

		if (result.rows.length === 0) {
			throw error(404, 'Location not found');
		}

		return { location: result.rows[0] };
	});
}
