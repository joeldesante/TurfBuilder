import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	const turfId = params.id;
	const locationId = params.location_id;
	const userId = locals.user!.id;
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		// Validate turf belongs to this org and the location is in this turf.
		const surveyResult = await client.query(
			`SELECT t.survey_id
			 FROM turf t
			 INNER JOIN turf_location tl ON tl.turf_id = t.id
			 WHERE tl.location_id = $1 AND t.id = $2 AND t.organization_id = $3`,
			[locationId, turfId, orgId]
		);

		if (surveyResult.rows.length === 0) {
			throw error(404, 'Location not found in this turf.');
		}

		const surveyId = surveyResult.rows[0].survey_id;

		const location = await client.query(
			`SELECT location_name, street, locality, postcode, region FROM location WHERE id = $1`,
			[locationId]
		);

		const questionsResult = await client.query(
			`SELECT id, question_text, question_type, order_index, choices
			 FROM survey_question
			 WHERE survey_id = $1
			 ORDER BY order_index ASC`,
			[surveyId]
		);
		const questions = questionsResult.rows;

		const turfLocationResult = await client.query(
			`SELECT id FROM turf_location WHERE turf_id = $1 AND location_id = $2`,
			[turfId, locationId]
		);
		const turfLocationId = turfLocationResult.rows[0].id;

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
			location: location.rows[0],
			locationAttempt,
			surveyId,
			questions,
			responses
		};
	});
}
