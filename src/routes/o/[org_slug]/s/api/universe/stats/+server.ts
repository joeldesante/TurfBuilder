import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function GET({ locals }) {
	if (!locals.organization?.role) return json({ error: 'Unauthorized' }, { status: 401 });

	return withOrgTransaction(locals.organization.id, async (client) => {
		const [people, locations] = await Promise.all([
			client.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count FROM universe.org_person WHERE org_id = $1`,
				[locals.organization!.id]
			),
			client.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count FROM universe.org_location WHERE org_id = $1`,
				[locals.organization!.id]
			)
		]);

		return json({
			people: parseInt(people.rows[0].count, 10),
			locations: parseInt(locations.rows[0].count, 10)
		});
	});
}
