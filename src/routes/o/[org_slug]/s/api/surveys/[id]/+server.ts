import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function PUT({ request, locals, params }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { name, description }: { name: string; description?: string } = await request.json();
		const { id } = params;

		if (!name || name.trim() === '') {
			throw new Error('Name cannot be empty.');
		}

		const client = await POOL.connect();
		try {
			await client.query(
				`UPDATE survey SET "name" = $1, description = $2 WHERE id = $3 AND organization_id = $4`,
				[name.trim(), description ?? null, id, locals.organization.id]
			);

			return json({ success: true }, { status: 201 });
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Error updating survey:', error);
		return json({ error: 'Failed to update survey' }, { status: 500 });
	}
}
