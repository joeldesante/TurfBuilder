import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

/**
 * Returns all location entries from a universe list with their coordinates.
 * Only works for lists with entity_type = 'locations'.
 *
 * @auth staff
 * @permission turf:create
 * @returns Array of location entries with lat/lng for map display
 */
export async function GET({ params, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const locations = await withOrgTransaction(locals.organization.id, async (client) => {
			const listResult = await client.query<{ id: string; entity_type: string }>(
				`SELECT l.id, l.entity_type
				 FROM universe.list l
				 JOIN universe.bucket b ON b.id = l.bucket
				 WHERE l.id = $1 AND l.org_id = $2`,
				[params.id, locals.organization!.id]
			);

			if (listResult.rows.length === 0) return null;

			const list = listResult.rows[0];
			if (list.entity_type !== 'locations') return { error: 'not_locations' as const };

			const result = await client.query<{
				record_id: string;
				record_source: string;
				name: string | null;
				address_line_1: string | null;
				city: string | null;
				state_or_region: string | null;
				postal_code: string | null;
				latitude: number;
				longitude: number;
				contact_made: boolean | null;
			}>(
				`SELECT
					le.record_id,
					le.record_source,
					COALESCE(pl.name, ol.name) AS name,
					COALESCE(pl.address_line_1, ol.address_line_1) AS address_line_1,
					COALESCE(pl.city, ol.city) AS city,
					COALESCE(pl.state_or_region, ol.state_or_region) AS state_or_region,
					COALESCE(pl.postal_code, ol.postal_code) AS postal_code,
					ST_Y(COALESCE(pl.coordinates, ol.coordinates)) AS latitude,
					ST_X(COALESCE(pl.coordinates, ol.coordinates)) AS longitude,
					(
						SELECT tla.contact_made
						FROM universe.turf_location tl
						JOIN universe.turf t ON t.id = tl.turf_id AND t.list_id = le.list_id
						JOIN universe.turf_location_attempt tla ON tla.turf_location_id = tl.id
						WHERE (
							(le.record_source = 'public_location' AND tl.public_location_id = le.record_id)
							OR (le.record_source = 'org_location' AND tl.org_location_id = le.record_id)
						)
						ORDER BY tla.updated_at DESC
						LIMIT 1
					) AS contact_made
				FROM universe.list_entry le
				LEFT JOIN universe.public_location pl
					ON le.record_source = 'public_location' AND pl.id = le.record_id
				LEFT JOIN universe.org_location ol
					ON le.record_source = 'org_location' AND ol.id = le.record_id
				WHERE le.list_id = $1
				AND COALESCE(pl.coordinates, ol.coordinates) IS NOT NULL`,
				[list.id]
			);

			return result.rows;
		});

		if (locations === null) return json({ error: 'List not found' }, { status: 404 });
		if (!Array.isArray(locations) && locations.error === 'not_locations') {
			return json({ error: 'List is not a locations list' }, { status: 400 });
		}

		return json(locations);
	} catch (err) {
		console.error('Error fetching list locations:', err);
		return json({ error: 'Failed to fetch locations' }, { status: 500 });
	}
}
