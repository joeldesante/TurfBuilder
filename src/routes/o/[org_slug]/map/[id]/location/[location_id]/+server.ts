import { json, error } from '@sveltejs/kit';
import * as z from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';

const schema = z.object({
	contactMade: z.boolean().default(false),
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
 * Upserts contact status, a free-text note, and all survey question responses in a single transaction.
 * Caller must be an assigned turf member.
 *
 * @auth org
 * @body contactMade {boolean} required - Whether the canvasser made contact at this address
 * @body attemptNote {string} - Optional free-text note about the visit
 * @body questions {Array<{db_id: uuid, response: string}>} required - Survey question responses
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
		const turf_userResult = await client.query(
			`SELECT id FROM turf_user WHERE turf_id = $1 AND user_id = $2`,
			[turfId, userId]
		);
		if (turf_userResult.rows.length === 0) {
			throw error(403, 'User must be a turf user to make a location attempt.');
		}

		const turfLocationResult = await client.query(
			`SELECT id FROM turf_location WHERE turf_id = $1 AND location_id = $2`,
			[turfId, locationId]
		);
		if (turfLocationResult.rows.length === 0) {
			throw error(404, 'Location not found in this turf.');
		}
		const turfLocationId = turfLocationResult.rows[0].id;

		const attemptResult = await client.query(
			`SELECT id FROM turf_location_attempt WHERE turf_location_id = $1 AND user_id = $2`,
			[turfLocationId, userId]
		);
		if (attemptResult.rows.length === 0) {
			throw error(404, 'Attempt not found.');
		}
		const attemptId = attemptResult.rows[0].id;

		await client.query(
			`UPDATE turf_location_attempt SET attempt_note = $1, contact_made = $2, updated_at = NOW() WHERE id = $3`,
			[val.attemptNote ?? '', val.contactMade, attemptId]
		);

		for (const question of val.questions) {
			await client.query(
				`INSERT INTO survey_question_response (response_value, survey_question_id, turf_location_attempt_id, organization_id)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (survey_question_id, turf_location_attempt_id)
				 DO UPDATE SET response_value = $1, updated_at = NOW()`,
				[question.response, question.db_id, attemptId, orgId]
			);
		}

		return json({ success: true }, { status: 201 });
	});
}
