import { withOrgTransaction } from '$lib/server/database';

const PAGE_SIZE = 100;

export async function load({ locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const [countResult, rowsResult] = await Promise.all([
			client.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count FROM universe.org_location WHERE org_id = $1`,
				[locals.organization!.id]
			),
			client.query(
				`SELECT id, name, address_line_1, address_line_2, city, state_or_region, postal_code
				 FROM universe.org_location
				 WHERE org_id = $1
				 ORDER BY name NULLS LAST, address_line_1 NULLS LAST
				 LIMIT $2`,
				[locals.organization!.id, PAGE_SIZE]
			)
		]);

		return {
			totalCount: parseInt(countResult.rows[0].count, 10),
			locations: rowsResult.rows
		};
	});
}
