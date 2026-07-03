import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

/**
 * Returns all turfs for a universe list, including polygon geometry (GeoJSON),
 * for the list overview map.
 *
 * @auth staff
 * @permission turf:read
 * @returns Array of turfs with GeoJSON bounds and metadata
 */
export async function GET({ params, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const turfs = await withOrgTransaction(locals.organization.id, async (client) => {
			const result = await client.query<{
				id: string;
				code: string;
				created_at: string;
				expires_at: string;
				author: string;
				survey_name: string | null;
				bounds: string | null;
			}>(
				`SELECT
					t.id,
					t.code,
					t.created_at,
					t.expires_at,
					u.username AS author,
					s.name AS survey_name,
					ST_AsGeoJSON(t.bounds)::text AS bounds
				FROM universe.turf t
				JOIN auth.user u ON t.author_id = u.id
				LEFT JOIN universe.survey s ON t.survey_id = s.id
				WHERE t.list_id = $1 AND t.org_id = $2 AND t.bounds IS NOT NULL
				ORDER BY t.created_at DESC`,
				[params.id, locals.organization!.id]
			);

			return result.rows;
		});

		return json(turfs);
	} catch (err) {
		console.error('Error fetching list turfs:', err);
		return json({ error: 'Failed to fetch turfs' }, { status: 500 });
	}
}
