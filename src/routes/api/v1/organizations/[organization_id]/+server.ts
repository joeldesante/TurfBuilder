import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import {
	getOrganization,
	replaceOrganization,
	updateOrganization
} from '$lib/server/services/organizations.service';
import { deleteOrg } from '$lib/server/services/platform-organizations.service';
import { parseBody } from '$lib/server/request';
import { deleteOrgSchema } from '$lib/shared/schemas/platform-organizations';

const slugSchema = z
	.string()
	.trim()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens');

const putSchema = z.object({
	name: z.string().trim().min(1),
	slug: slugSchema
});

const patchSchema = putSchema.partial();

/**
 * One organization.
 *
 * @auth user
 * @returns `{ id, name, slug, created_at }`, plus `platform` (PlatformOrgDetail) for infra admins, who can read any organization. 400 for an invalid id, 401 when signed out, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await getOrganization(userId, orgId));
};

/**
 * Replaces an organization's name and slug. Both are required.
 *
 * @auth owner
 * @body name {string} - Display name of the organization
 * @body slug {string} - URL slug, unique across organizations
 * @returns The organization. 400 for an invalid id or body, 401 when signed out, 403 when the caller is not an owner, 404 when the caller is not a member, 409 for a taken slug
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	const body = putSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await replaceOrganization(userId, orgId, body.data));
};

/**
 * Updates the given fields of an organization and leaves the rest as they are.
 *
 * @auth owner
 * @body name {string} - Optional. Display name of the organization
 * @body slug {string} - Optional. URL slug, unique across organizations
 * @returns The organization. 400 for an invalid id or body, 401 when signed out, 403 when the caller is not an owner, 404 when the caller is not a member, 409 for a taken slug
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	const body = patchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await updateOrganization(userId, orgId, body.data));
};

/**
 * Soft-deletes the organization. Members lose it; its data stays and an infra admin can restore it.
 *
 * @auth infra orgs.manage
 * @body confirmSlug {string} - The organization's slug, typed to confirm
 * @returns 204. 400 when the slug does not match, 403 without orgs.manage, 404 for an unknown org, 409 when already deleted
 */
export const DELETE: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { confirmSlug } = await parseBody(request, deleteOrgSchema);
	await deleteOrg(userId, orgId, confirmSlug);
	return new Response(null, { status: 204 });
};
