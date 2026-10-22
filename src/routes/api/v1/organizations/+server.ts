import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { createOrganization } from '$lib/server/services/organizations.service';
import { listOrgs } from '$lib/server/services/platform-organizations.service';
import { requestedPage } from '$lib/shared/utils/pagination';
import { orgFiltersFromUrl } from '$lib/shared/schemas/platform-organizations';

const postSchema = z.object({
	name: z.string().trim().min(1),
	slug: z
		.string()
		.trim()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens')
});

/**
 * Every organization on the instance, one page at a time. Deleted ones only with `status=deleted`.
 *
 * @auth infra access
 * @query q {string} - Optional. Matches name or slug
 * @query status {'all'|'active'|'inactive'|'suspended'|'deleted'} - Optional. Active and inactive mean used, or not, in the last 90 days
 * @query sort {'newest'|'oldest'|'members'|'recently_active'|'name'} - Optional. Default newest
 * @query page {number} - Optional. 1-based page of 100
 * @returns `{ items: PlatformOrgRow[], totalCount, page, pageSize }`. 401 when signed out, 403 without infra access
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = requireUser(locals);
	return json(await listOrgs(userId, orgFiltersFromUrl(url), requestedPage(url)));
};

/**
 * Creates a new organization with the caller as its owner.
 *
 * Goes through better-auth so the default roles are created too. Fails with 403 when
 * creation is disabled in system settings and 409 when the slug is taken.
 *
 * @auth user
 * @body name {string} - Display name of the organization
 * @body slug {string} - URL slug, unique across organizations
 * @returns 201 `{ id, name, slug, created_at }`. 400 for an invalid body, 401 when signed out, 403 when creation is disabled, 409 for a taken slug
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = requireUser(locals);

	const body = postSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await createOrganization(userId, body.data, request.headers), { status: 201 });
};
