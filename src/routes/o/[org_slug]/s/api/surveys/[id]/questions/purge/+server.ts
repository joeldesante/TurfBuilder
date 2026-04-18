import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

/**
 * Deletes all questions for a survey except those listed in `exclude`.
 * Called before re-saving the full question set to remove questions the
 * editor dropped. Pass all retained question IDs in `exclude`.
 *
 * @auth staff
 * @permission survey:update
 * @body exclude {string[]} - UUIDs of questions to keep; all others are deleted
 * @returns { success: true }
 */
export async function POST({ request, locals, params }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'survey', 'update')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { exclude }: { exclude: string[] | undefined } = await request.json();
		const { id } = params;

		await withOrgTransaction(locals.organization.id, async (client) => {
			// Verify the survey belongs to this org before mutating.
			const surveyCheck = await client.query(
				`SELECT id FROM survey WHERE id = $1 AND organization_id = $2`,
				[id, locals.organization!.id]
			);
			if (surveyCheck.rows.length === 0) {
				throw Object.assign(new Error('Survey not found'), { status: 404 });
			}

			const exclude_ids = exclude || [];
			await client.query(
				`DELETE FROM survey_question WHERE id != ALL($1) AND survey_id = $2 AND organization_id = $3`,
				[exclude_ids, id, locals.organization!.id]
			);
		});

		return json({ success: true }, { status: 201 });
	} catch (error) {
		console.error('Error purging questions:', error);
		return json({ error: 'Failed to purge questions' }, { status: 500 });
	}
}
