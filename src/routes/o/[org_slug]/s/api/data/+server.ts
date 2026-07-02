import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

const DataRequestSchema = z.object({});

export async function POST({ request, locals }) {
	if (!locals.user || !locals.organization?.role) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const body = await request.json();
	const parsed = DataRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	const org = locals.organization;

	return withOrgTransaction(org.id, async (client) => {
		const result = await client.query(
			`SELECT 1`,
			[org.id]
		);
		return json({ rows: result.rows });
	});
}

/*

Data Fetch Schema:

Query {
	name: string,
	query: string
}

Query Selectior:

Entity Type:
- Person
- Location

Standard Scema Values:
- 

1) We are selecting some data from an entity of some kind

{mode}(		// list | avg | count | sum | min | max - list just returns all results matching as a list
	entity.
		{entity_type}.
			{bucket:bucket_id | bucket:all}.
				{value:value_name}	// Note: There are reserved value names that can not be used in a custom schema. First it searchs through the reserved words, then it searches the users custom schema
).filter(	// Filters
	
)


{
	queries: Query[
		{
			name: "a",
			query: ""
		}
	]
}





*/
