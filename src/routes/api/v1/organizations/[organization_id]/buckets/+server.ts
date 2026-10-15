import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { bucketFiltersSchema } from '$lib/shared/schemas/filters';
import { createBucket, listBuckets } from '$lib/server/services/buckets.service';

const postSchema = z.object({
	name: z.string().trim().min(1),
	slug: z
		.string()
		.trim()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens'),
	filters: bucketFiltersSchema
});

/**
 * The organization's buckets, newest first.
 *
 * @auth staff
 * @returns `Array<{ id, org_id, name, slug, filters, created_at }>`. `filters` is null for a bucket made before the filter editor whose old filter could not be converted. 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listBuckets(userId, orgId));
};

/**
 * Creates a new bucket (a saved filter over the org's entities) in the
 * organization.
 *
 * @auth staff
 * @body name {string} - Display name of the bucket
 * @body slug {string} - URL slug, unique within the organization
 * @body filters {object} - What the bucket selects: `{ v: 2, people, locations }`, each a filter group or null for a kind of record the bucket does not include
 * @returns 201 with the bucket. 400 for an invalid body, 401 when signed out, 403 without staff access, 404 when the caller is not a member, 409 for a taken slug
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	const body = postSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await createBucket(userId, orgId, body.data), { status: 201 });
};
