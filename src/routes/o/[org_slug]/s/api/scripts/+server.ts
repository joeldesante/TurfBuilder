import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { z } from 'zod';

const CreateScriptSchema = z.object({
	name: z.string().trim().min(1, 'Name is required.'),
	bucketId: z.string().uuid('Invalid bucket ID.')
});

export async function POST({ request, locals }) {
	if (!locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const body = await request.json();
	const parsed = CreateScriptSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}
	const { name, bucketId } = parsed.data;

	return withOrgTransaction(locals.organization.id, async (client) => {
		const bucket = await client.query(
			`SELECT id FROM universe.bucket WHERE id = $1 AND org_id = $2`,
			[bucketId, locals.organization!.id]
		);
		if (bucket.rows.length === 0) {
			return json({ error: 'Bucket not found.' }, { status: 404 });
		}

		const result = await client.query<{ id: string }>(
			`INSERT INTO universe.script (name, contents, org_id, bucket)
			 VALUES ($1, '', $2, $3)
			 RETURNING id`,
			[name, locals.organization!.id, bucketId]
		);
		return json(result.rows[0], { status: 201 });
	});
}
