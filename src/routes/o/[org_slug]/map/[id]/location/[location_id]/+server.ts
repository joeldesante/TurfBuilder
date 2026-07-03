import { json, error } from '@sveltejs/kit';
import * as z from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';

const schema = z.object({
	contactStatus: z.enum(['no_contact', 'contacted']),
	attemptNote: z.string().default('').optional(),
	questions: z.array(
		z.object({
			db_id: z.string().uuid(),
			type: z.string().optional(),
			text: z.string().optional(),
			choices: z.array(z.string()).optional(),
			index: z.number().optional(),
			response: z.string()
		})
	)
});

/**
 * Records a door-knock attempt for a specific address within a turf.
 * Creates or updates the attempt record, then saves survey responses when contact was made.
 * Caller must be an assigned turf member.
 *
 * @auth org
 * @body contactStatus {'no_contact'|'contacted'} required - Outcome of the canvassing visit
 * @body attemptNote {string} - Optional free-text note about the visit
 * @body questions {Array<{db_id: uuid, response: string}>} required - Survey question responses (only saved when contacted)
 * @returns { success: true }
 */
export async function POST({ request, locals, params }) {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const turfId = params.id;
	const locationId = params.location_id;
	const orgId = locals.organization!.id;
	const userId = locals.user.id;

	let val;
	try {
		val = schema.parse(await request.json());
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	return withOrgTransaction(orgId, async (client) => {
		const turfUserResult = await client.query(
			`SELECT id FROM universe.turf_user WHERE turf_id = $1 AND user_id = $2`,
			[turfId, userId]
		);
		if (turfUserResult.rows.length === 0) {
			throw error(403, 'User must be a turf user to make a location attempt.');
		}

		const turfLocationResult = await client.query(
			`SELECT id FROM universe.turf_location WHERE id = $1 AND turf_id = $2 AND org_id = $3`,
			[locationId, turfId, orgId]
		);
		if (turfLocationResult.rows.length === 0) {
			throw error(404, 'Location not found in this turf.');
		}
		const turfLocationId = turfLocationResult.rows[0].id;

		const contactMade = val.contactStatus === 'contacted';

		const attemptResult = await client.query(
			`INSERT INTO universe.turf_location_attempt (turf_location_id, user_id, org_id, contact_made, attempt_note)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (turf_location_id, user_id)
			 DO UPDATE SET contact_made = $4, attempt_note = $5, updated_at = NOW()
			 RETURNING id`,
			[turfLocationId, userId, orgId, contactMade, val.attemptNote ?? '']
		);
		const attemptId = attemptResult.rows[0].id;

		if (contactMade) {
			for (const question of val.questions) {
				await client.query(
					`INSERT INTO universe.survey_question_response (response_value, survey_question_id, turf_location_attempt_id, org_id)
					 VALUES ($1, $2, $3, $4)
					 ON CONFLICT (survey_question_id, turf_location_attempt_id)
					 DO UPDATE SET response_value = $1, updated_at = NOW()`,
					[question.response, question.db_id, attemptId, orgId]
				);
			}
		}

		return json({ success: true }, { status: 201 });
	});
}
