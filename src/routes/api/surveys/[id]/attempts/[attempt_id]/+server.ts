import { json } from '@sveltejs/kit';
import * as z from 'zod';
import { POOL } from '$lib/server/database.js';

export async function POST({ request, locals, params }) {
	// Check authentication
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let schema = z.object({
		turf_id: z.uuidv4(),
		contactMade: z.boolean().default(false),
		attemptNote: z.string().default('').optional(),
		questions: z.array(
			z.object({
				db_id: z.uuidv4(),
				type: z.string().optional(),
				text: z.string().optional(),
				choices: z.array(z.string()).optional(),
				index: z.number().optional(),
				response: z.string()
			})
		)
	});

	try {
		const { questions, attemptNote, contactMade, turf_id } = await request.json();
		const { attempt_id } = params;
		const client = await POOL.connect();

		try {
			let val = schema.parse({
				turf_id: turf_id,
				contactMade: contactMade,
				attemptNote: attemptNote || '',
				questions: questions
			});

			// Verify the attempt exists, belongs to a location in the given turf, and belongs to this user.
			// This prevents a user from submitting responses against an attempt they don't own
			// or that belongs to a different turf/org.
			const ownershipCheck = await client.query(
				`SELECT tla.id
				 FROM turf_location_attempt tla
				 JOIN turf_location tl ON tl.id = tla.turf_location_id
				 WHERE tla.id = $1 AND tl.turf_id = $2 AND tla.user_id = $3`,
				[attempt_id, turf_id, locals.user.id]
			);
			if (ownershipCheck.rowCount == 0 || ownershipCheck.rowCount == null) {
				throw new Error('Attempt not found or does not belong to this user and turf.');
			}

			// Check if the user is assigned to the turf they are submitting for.
			let response = await client.query(
				'SELECT id FROM turf_user WHERE turf_id = $1 AND user_id = $2',
				[turf_id, locals.user.id]
			);

			if (response.rowCount == 0 || response.rowCount == null) {
				throw new Error('User must be a turf user to make a location attempt.');
			}

			await client.query(
				'UPDATE turf_location_attempt SET attempt_note = $1, contact_made = $2, updated_at = NOW() WHERE user_id = $3 AND id = $4',
				[val.attemptNote, val.contactMade, locals.user.id, attempt_id]
			);

			// Fetch the org for this attempt so we can stamp organization_id.
			const orgRow = await client.query(
				`SELECT t.organization_id
				 FROM turf_location_attempt tla
				 JOIN turf_location tl ON tl.id = tla.turf_location_id
				 JOIN turf t ON t.id = tl.turf_id
				 WHERE tla.id = $1`,
				[attempt_id]
			);
			const attemptOrgId = orgRow.rows[0].organization_id;

			// Now we need to update the response if it already exists and insert if it doesn't
			for (let i = 0; i < questions.length; i++) {
				await client.query(
					`INSERT INTO survey_question_response (response_value, survey_question_id, turf_location_attempt_id, organization_id)
					 VALUES ($1, $2, $3, $4)
					 ON CONFLICT (survey_question_id, turf_location_attempt_id)
					 DO UPDATE SET response_value = $1, updated_at = NOW()`,
					[val.questions[i].response, val.questions[i].db_id, attempt_id, attemptOrgId]
				);
			}

			return json(
				{
					success: true
				},
				{ status: 201 }
			);
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error saving attempt:', error);
		return json({ error: 'Failed to save attempt' }, { status: 500 });
	}
}
