import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { z } from 'zod';

/**
 * Lists scripts for the organization, optionally filtered by bucket slug.
 *
 * @auth staff
 * @query bucket {string} optional - bucket slug to filter by
 * @returns Array of { id: string, name: string }
 */
export async function GET({ locals, url }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const bucketSlug = url.searchParams.get('bucket');

	return withOrgTransaction(locals.organization.id, async (client) => {
		let result;
		if (bucketSlug) {
			result = await client.query<{ id: string; name: string }>(
				`SELECT s.id, s.name
				 FROM universe.script s
				 JOIN universe.bucket b ON b.id = s.bucket
				 WHERE s.org_id = $1 AND b.slug = $2
				 ORDER BY s.name ASC`,
				[locals.organization!.id, bucketSlug]
			);
		} else {
			result = await client.query<{ id: string; name: string }>(
				`SELECT id, name FROM universe.script
				 WHERE org_id = $1
				 ORDER BY name ASC`,
				[locals.organization!.id]
			);
		}
		return json(result.rows);
	});
}

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
