import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
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

		return {
			peopleCount: parseInt(people.rows[0].count, 10),
			locationsCount: parseInt(locations.rows[0].count, 10)
		};
	});
}
