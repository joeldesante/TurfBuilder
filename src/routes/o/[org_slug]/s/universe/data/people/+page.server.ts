import { withOrgTransaction } from '$lib/server/database';

const PAGE_SIZE = 100;

export async function load({ locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const [countResult, rowsResult] = await Promise.all([
			client.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count FROM universe.org_person WHERE org_id = $1`,
				[locals.organization!.id]
			),
			client.query(
				`SELECT id, first_name, last_name, email, phone, dob
				 FROM universe.org_person
				 WHERE org_id = $1
				 ORDER BY last_name NULLS LAST, first_name NULLS LAST
				 LIMIT $2`,
				[locals.organization!.id, PAGE_SIZE]
			)
		]);

		return {
			totalCount: parseInt(countResult.rows[0].count, 10),
			people: rowsResult.rows
		};
	});
}
