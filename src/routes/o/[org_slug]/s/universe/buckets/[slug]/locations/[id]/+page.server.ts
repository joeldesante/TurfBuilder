import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import type { LocationDetail } from '$pages/o/s/universe/buckets/locations/LocationDetailPage.svelte';

export async function load({ params, locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query<LocationDetail>(
			`SELECT
				ol.id,
				ol.name,
				ol.address_line_1,
				ol.address_line_2,
				ol.address_line_3,
				ol.city,
				ol.state_or_region,
				ol.postal_code,
				ol.country_code
			FROM universe.org_location ol
			WHERE ol.id = $1
			  AND ol.org_id = $2
			  AND ol.valid_to IS NULL`,
			[params.id, locals.organization!.id]
		);

		if (result.rows.length === 0) {
			throw error(404, 'Location not found');
		}

		return { location: result.rows[0] };
	});
}
