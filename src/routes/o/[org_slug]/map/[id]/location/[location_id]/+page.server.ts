import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	const turfId = params.id;
	const locationId = params.location_id;
	const userId = locals.user!.id;
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		// Look up the turf_location row (which is now the location identifier) and join to get survey + location details.
		const turfLocationResult = await client.query(
			`SELECT
			        tl.id AS turf_location_id,
			        t.survey_id,
			        COALESCE(l.location_name, ol.location_name, upl.name, uol.name) AS location_name,
			        COALESCE(l.street, ol.street, upl.address_line_1, uol.address_line_1) AS street,
			        COALESCE(l.locality, ol.locality, upl.city, uol.city) AS locality,
			        COALESCE(l.postcode, ol.postcode, upl.postal_code, uol.postal_code) AS postcode,
			        COALESCE(l.region, ol.region, upl.state_or_region, uol.state_or_region) AS region
			 FROM turf_location tl
			 JOIN turf t ON t.id = tl.turf_id
			 LEFT JOIN location l ON l.id = tl.location_id
			 LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			 LEFT JOIN universe.public_location upl ON upl.id = tl.universe_public_location_id
			 LEFT JOIN universe.org_location uol ON uol.id = tl.universe_org_location_id
			 WHERE tl.id = $1 AND tl.turf_id = $2 AND tl.organization_id = $3`,
			[locationId, turfId, orgId]
		);

		if (turfLocationResult.rows.length === 0) {
			throw error(404, 'Location not found in this turf.');
		}

		const { turf_location_id: turfLocationId, survey_id: surveyId, ...locationFields } = turfLocationResult.rows[0];

		const questionsResult = await client.query(
			`SELECT id, question_text, question_type, order_index, choices
			 FROM survey_question
			 WHERE survey_id = $1
			 ORDER BY order_index ASC`,
			[surveyId]
		);
		const questions = questionsResult.rows;

		const locationAttemptResult = await client.query(
			`INSERT INTO turf_location_attempt (turf_location_id, user_id, organization_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (turf_location_id, user_id)
			 DO UPDATE SET updated_at = NOW()
			 RETURNING id, contact_made, attempt_note`,
			[turfLocationId, userId, orgId]
		);
		const locationAttempt = locationAttemptResult.rows[0];

		let responses = [];
		if (questions.length > 0) {
			const questionIds = questions.map((q) => q.id);
			const responsesResult = await client.query(
				`SELECT survey_question_id, response_value, created_at
				 FROM survey_question_response
				 WHERE turf_location_attempt_id = $1 AND survey_question_id = ANY($2)`,
				[locationAttempt.id, questionIds]
			);
			responses = responsesResult.rows;
		}

		return {
			turfId,
			location: locationFields,
			locationAttempt,
			surveyId,
			questions,
			responses
		};
	});
}
