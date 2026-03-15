import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function POST({ request, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { name }: { name: string } = await request.json();

		if (!name || name.trim() === '') {
			return json({ error: 'Name is required.' }, { status: 400 });
		}

		const client = await POOL.connect();
		try {
			const result = await client.query(
				`INSERT INTO survey (name, organization_id) VALUES ($1, $2) RETURNING id`,
				[name.trim(), locals.organization.id]
			);

			return json({ id: result.rows[0].id }, { status: 201 });
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error creating survey:', error);
		return json({ error: 'Failed to create survey' }, { status: 500 });
	}
}
