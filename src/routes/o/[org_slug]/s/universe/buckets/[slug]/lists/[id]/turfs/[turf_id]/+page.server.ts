import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!locals.organization?.role) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		// Load the turf, verifying it belongs to this list and bucket.
		const turfResult = await client.query<{
			id: string;
			code: string;
			expires_at: string;
			created_at: string;
			author: string;
			survey_name: string | null;
			bounds: string | null;
			list_name: string;
			bucket_name: string;
		}>(
			`SELECT
				t.id, t.code, t.expires_at, t.created_at,
				u.username AS author,
				s.name AS survey_name,
				ST_AsGeoJSON(t.bounds)::text AS bounds,
				l.name AS list_name,
				b.name AS bucket_name
			 FROM turf t
			 JOIN auth.user u ON t.author_id = u.id
			 LEFT JOIN survey s ON t.survey_id = s.id
			 JOIN universe.list l ON l.id = t.list_id
			 JOIN universe.bucket b ON b.id = l.bucket
			 WHERE t.id = $1
			   AND t.organization_id = $2
			   AND t.list_id = $3
			   AND b.slug = $4`,
			[params.turf_id, locals.organization.id, params.id, params.slug]
		);

		if (turfResult.rows.length === 0) throw error(404, 'Turf not found.');
		const turf = turfResult.rows[0];

		// Load all locations in this turf with their most recent attempt status.
		const locationsResult = await client.query<{
			turf_location_id: string;
			name: string | null;
			address_line_1: string | null;
			city: string | null;
			state_or_region: string | null;
			latitude: number | null;
			longitude: number | null;
			attempt_id: string | null;
			contact_made: boolean | null;
			attempt_note: string | null;
			attempted_at: string | null;
		}>(
			`SELECT
				tl.id AS turf_location_id,
				COALESCE(pl.name, ol.name, l.location_name) AS name,
				COALESCE(pl.address_line_1, ol.address_line_1, l.street) AS address_line_1,
				COALESCE(pl.city, ol.city, l.locality) AS city,
				COALESCE(pl.state_or_region, ol.state_or_region, l.region) AS state_or_region,
				COALESCE(ST_Y(pl.coordinates), ST_Y(ol.coordinates), l.latitude::float) AS latitude,
				COALESCE(ST_X(pl.coordinates), ST_X(ol.coordinates), l.longitude::float) AS longitude,
				tla.id AS attempt_id,
				tla.contact_made,
				tla.attempt_note,
				tla.updated_at AS attempted_at
			FROM turf_location tl
			LEFT JOIN universe.public_location pl ON tl.universe_public_location_id = pl.id
			LEFT JOIN universe.org_location ol ON tl.universe_org_location_id = ol.id
			LEFT JOIN location l ON tl.location_id = l.id
			LEFT JOIN LATERAL (
				SELECT id, contact_made, attempt_note, updated_at
				FROM turf_location_attempt
				WHERE turf_location_id = tl.id
				ORDER BY updated_at DESC
				LIMIT 1
			) tla ON true
			WHERE tl.turf_id = $1 AND tl.organization_id = $2
			ORDER BY COALESCE(pl.name, ol.name, l.location_name)`,
			[params.turf_id, locals.organization.id]
		);

		const locations = locationsResult.rows;
		const attemptIds = locations.map((l) => l.attempt_id).filter(Boolean) as string[];

		// Load survey responses for all latest attempts in this turf.
		let responses: {
			attempt_id: string;
			turf_location_id: string;
			question_id: string;
			question_text: string;
			question_type: string;
			order_index: number;
			response_value: string;
		}[] = [];

		if (attemptIds.length > 0) {
			const responsesResult = await client.query(
				`SELECT
					tla.id AS attempt_id,
					tla.turf_location_id,
					sq.id AS question_id,
					sq.question_text,
					sq.question_type,
					sq.order_index::int AS order_index,
					sqr.response_value
				FROM turf_location_attempt tla
				JOIN survey_question_response sqr ON sqr.turf_location_attempt_id = tla.id
				JOIN survey_question sq ON sq.id = sqr.survey_question_id
				WHERE tla.id = ANY($1)
				ORDER BY tla.turf_location_id, sq.order_index::int`,
				[attemptIds]
			);
			responses = responsesResult.rows;
		}

		return {
			turf,
			listId: params.id,
			bucketSlug: params.slug,
			locations,
			responses
		};
	});
}
