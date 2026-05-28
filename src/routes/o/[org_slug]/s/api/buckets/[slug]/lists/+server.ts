import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import { parseBucketFilter, FilterConditionSchema } from '$lib/server/filter-converter';
import { buildBucketMatchQuery, buildListSnapshotInsert } from '$lib/server/list-creator';

const CreateListSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	entity_type: z.enum(['people', 'locations']),
	expires_at: z.string().datetime({ message: 'A valid expiration date is required' }),
	filter: z.object({
		matchType: z.enum(['ONE_OR_MORE', 'ALL', 'NONE']),
		conditions: z.array(FilterConditionSchema)
	})
});

export async function POST({ params, locals, request }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => null);
	const parsed = CreateListSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request');
	}

	const { name, entity_type, expires_at, filter } = parsed.data;

	return withOrgTransaction(locals.organization.id, async (client) => {
		// Load the bucket and verify it belongs to this org.
		const bucketResult = await client.query<{ id: string; filter: unknown }>(
			`SELECT id, filter FROM universe.bucket WHERE org_id = $1 AND slug = $2`,
			[locals.organization!.id, params.slug]
		);
		if (bucketResult.rows.length === 0) throw error(404, 'Bucket not found');

		const bucket = bucketResult.rows[0];
		const bucketFilter = parseBucketFilter(bucket.filter);

		// Ensure the bucket actually includes the requested entity type.
		const entityEnabled =
			entity_type === 'people'
				? bucketFilter.people.enabled
				: bucketFilter.locations.enabled;
		if (!entityEnabled) {
			throw error(400, `This bucket does not include ${entity_type}`);
		}

		// Step 1: Run the bucket's stored filter query to collect matching IDs.
		// This runs in its own scope so the bucket's stored column aliases never
		// conflict with the view aliases used in the snapshot INSERT below.
		const bucketMatchQuery = buildBucketMatchQuery(entity_type, bucketFilter);
		let bucketMatchIds: string[] | null = null;
		if (bucketMatchQuery) {
			const matchResult = await client.query<{ id: string }>(
				bucketMatchQuery.sql,
				bucketMatchQuery.params
			);
			bucketMatchIds = matchResult.rows.map((r) => r.id);
			// If the bucket filter produced zero results there is nothing to snapshot.
			if (bucketMatchIds.length === 0) {
				const listResult = await client.query<{ id: string }>(
					`INSERT INTO universe.list (name, bucket, org_id, entity_type, expires_at)
					 VALUES ($1, $2, $3, $4, $5)
					 RETURNING id`,
					[name, bucket.id, locals.organization!.id, entity_type, expires_at]
				);
				return json({ id: listResult.rows[0].id }, { status: 201 });
			}
		}

		// Step 2: Insert the list row.
		const listResult = await client.query<{ id: string }>(
			`INSERT INTO universe.list (name, bucket, org_id, entity_type, expires_at)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			[name, bucket.id, locals.organization!.id, entity_type, expires_at]
		);
		const listId = listResult.rows[0].id;

		// Step 3: Snapshot the matching records into list_entry.
		// The list's additional filter conditions are applied here against the
		// view, intersected with bucketMatchIds via ANY($2).
		const { sql, params: snapshotParams } = buildListSnapshotInsert(
			listId,
			entity_type,
			bucketMatchIds,
			filter
		);
		await client.query(sql, snapshotParams);

		return json({ id: listId }, { status: 201 });
	});
}
