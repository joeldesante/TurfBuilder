import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function POST({ request, locals, params }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { exclude }: { exclude: string[] | undefined } = await request.json();
		const { id } = params;
		const client = await POOL.connect();

		// Verify the survey belongs to this org before mutating.
		const surveyCheck = await client.query(
			`SELECT id FROM survey WHERE id = $1 AND organization_id = $2`,
			[id, locals.organization.id]
		);
		if (surveyCheck.rows.length === 0) {
			client.release();
			return json({ error: 'Survey not found' }, { status: 404 });
		}

		try {
			const exclude_ids = exclude || [];
			await client.query(
				`DELETE FROM survey_question WHERE id != ALL($1) AND survey_id = $2`,
				[exclude_ids, id]
			);

			return json({ success: true }, { status: 201 });
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error purging questions:', error);
		return json({ error: 'Failed to purge questions' }, { status: 500 });
	}
}
