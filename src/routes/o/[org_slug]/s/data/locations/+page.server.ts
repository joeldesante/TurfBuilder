import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`SELECT id, location_name, category, street, locality, postcode, region, country, latitude, longitude
			 FROM location
			 WHERE organization_id IS NULL OR organization_id = $1
			 ORDER BY location_name
			 LIMIT 2000`,
			[locals.organization!.id]
		);
		return { locations: result.rows };
	});
}
