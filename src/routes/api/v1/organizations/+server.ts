import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { createOrganization } from '$lib/server/services/organizations.service';
import { listOrgs } from '$lib/server/services/platform-organizations.service';
import { createOrganizationSchema } from '$lib/shared/schemas/organizations';
import { requestedPage } from '$lib/shared/utils/pagination';
import { orgFiltersFromUrl } from '$lib/shared/schemas/platform-organizations';

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

	const body = await parseBody(request, createOrganizationSchema);

	return json(await createOrganization(userId, body, request.headers), { status: 201 });
};
