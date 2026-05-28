import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { z } from 'zod';
import { BucketFilterInputSchema, convertBucketFilter } from '$lib/server/filter-converter';

const CreateBucketSchema = z.object({
	name: z.string().trim().min(1, 'Name is required.'),
	slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only.'),
	filter: BucketFilterInputSchema
});

export async function POST({ request, locals }) {
	if (!locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const body = await request.json();
	const parsed = CreateBucketSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}
	const { name, slug, filter } = parsed.data;

	const storedFilter = convertBucketFilter(filter);

	return withOrgTransaction(locals.organization.id, async (client) => {
		const existing = await client.query(
			`SELECT id FROM universe.bucket WHERE org_id = $1 AND slug = $2`,
			[locals.organization!.id, slug]
		);
		if (existing.rows.length > 0) {
			return json({ error: 'A bucket with that name already exists.' }, { status: 409 });
		}

		const result = await client.query<{ id: string; slug: string }>(
			`INSERT INTO universe.bucket (name, slug, org_id, filter)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, slug`,
			[name, slug, locals.organization!.id, JSON.stringify(storedFilter)]
		);
		return json(result.rows[0], { status: 201 });
	});
}
