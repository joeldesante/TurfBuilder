import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

/**
 * Creates a new survey template for the organization with no questions.
 * Questions are added separately via the /questions endpoint.
 *
 * @auth staff
 * @permission survey:create
 * @body name {string} required - Survey name, 1–255 characters
 * @returns { id: string } UUID of the created survey
 */
export async function POST({ request, locals }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'survey', 'create')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const { name }: { name: string } = await request.json();

		if (!name || name.trim() === '') {
			return json({ error: 'Name is required.' }, { status: 400 });
		}
		if (name.trim().length > 255) {
			return json({ error: 'Name must be 255 characters or fewer.' }, { status: 400 });
		}

		const result = await withOrgTransaction(locals.organization.id, async (client) => {
			return client.query(
				`INSERT INTO survey (name, organization_id) VALUES ($1, $2) RETURNING id`,
				[name.trim(), locals.organization!.id]
			);
		});

		return json({ id: result.rows[0].id }, { status: 201 });
	} catch (error) {
		console.error('Error creating survey:', error);
		return json({ error: 'Failed to create survey' }, { status: 500 });
	}
}
