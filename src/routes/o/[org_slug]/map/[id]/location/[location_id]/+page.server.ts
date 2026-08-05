import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	const turfId = params.id;
	const locationId = params.location_id;
	const userId = locals.user!.id;
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const turfLocationResult = await client.query(
			`SELECT
			        tl.id AS turf_location_id,
			        t.survey_id,
			        sc.contents AS script_contents,
			        COALESCE(pl.name, ol.name) AS location_name,
			        COALESCE(pl.address_line_1, ol.address_line_1) AS street,
			        COALESCE(pl.city, ol.city) AS locality,
			        COALESCE(pl.postal_code, ol.postal_code) AS postcode,
			        COALESCE(pl.state_or_region, ol.state_or_region) AS region
			 FROM universe.turf_location tl
			 JOIN universe.turf t ON t.id = tl.turf_id
			 LEFT JOIN universe.script sc ON sc.id = t.script_id
			 LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
			 LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
			 WHERE tl.id = $1 AND tl.turf_id = $2 AND tl.org_id = $3
			   AND COALESCE(pl.valid_to, ol.valid_to) IS NULL`,
			[locationId, turfId, orgId]
		);

		if (turfLocationResult.rows.length === 0) {
			throw error(404, 'Location not found in this turf.');
		}

		const {
			turf_location_id: turfLocationId,
			survey_id: surveyId,
			script_contents: scriptContents,
			...locationFields
		} = turfLocationResult.rows[0];

		const questionsResult = await client.query(
			`SELECT id, question_text, question_type, order_index, choices
			 FROM universe.survey_question
			 WHERE survey_id = $1
			 ORDER BY order_index ASC`,
			[surveyId]
		);
		const questions = questionsResult.rows;

		// Check for an existing attempt without creating one — an attempt is only
		// created when the user explicitly selects a contact status and saves.
		const attemptResult = await client.query(
			`SELECT id, contact_made, attempt_note
			 FROM universe.turf_location_attempt
			 WHERE turf_location_id = $1 AND user_id = $2`,
			[turfLocationId, userId]
		);
		const existingAttempt = attemptResult.rows[0] ?? null;

		let responses: { survey_question_id: string; response_value: string }[] = [];
		if (existingAttempt && questions.length > 0) {
			const questionIds = questions.map((q) => q.id);
			const responsesResult = await client.query(
				`SELECT survey_question_id, response_value
				 FROM universe.survey_question_response
				 WHERE turf_location_attempt_id = $1 AND survey_question_id = ANY($2)`,
				[existingAttempt.id, questionIds]
			);
			responses = responsesResult.rows;
		}

		return {
			turfId,
			location: locationFields,
			scriptContents: scriptContents ?? null,
			existingContactMade: existingAttempt ? (existingAttempt.contact_made as boolean) : null,
			existingAttemptNote: existingAttempt?.attempt_note ?? '',
			surveyId,
			questions,
			responses
		};
	});
}
