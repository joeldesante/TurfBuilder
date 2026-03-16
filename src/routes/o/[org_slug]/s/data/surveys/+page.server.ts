import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const surveys = await client.query(
			`SELECT * FROM survey WHERE organization_id = $1`,
			[locals.organization!.id]
		);
		return { surveys: surveys.rows };
	});
}
