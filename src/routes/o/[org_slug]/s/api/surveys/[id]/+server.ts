import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

export async function PUT({ request, locals, params }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'survey', 'update')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { name, description }: { name: string; description?: string } = await request.json();
		const { id } = params;

		if (!name || name.trim() === '') {
			return json({ error: 'Name cannot be empty.' }, { status: 400 });
		}
		if (name.trim().length > 255) {
			return json({ error: 'Name must be 255 characters or fewer.' }, { status: 400 });
		}
		if (description && description.length > 2000) {
			return json({ error: 'Description must be 2000 characters or fewer.' }, { status: 400 });
		}

		await withOrgTransaction(locals.organization.id, async (client) => {
			await client.query(
				`UPDATE survey SET "name" = $1, description = $2 WHERE id = $3 AND organization_id = $4`,
				[name.trim(), description ?? null, id, locals.organization!.id]
			);
		});

		return json({ success: true }, { status: 201 });
	} catch (error) {
		console.error('Error updating survey:', error);
		return json({ error: 'Failed to update survey' }, { status: 500 });
	}
}
