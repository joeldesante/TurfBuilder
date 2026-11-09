import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { createRole, listRoles } from '$lib/server/services/roles.service';
import { createRoleSchema } from '$lib/shared/schemas/roles';

/**
 * The organization's permission roles, highest priority (lowest weight) first.
 *
 * @auth role.read
 * @returns `Array<{ id, name, is_default, weight, permissions: string[] }>`. 400 for an invalid id, 401 when signed out, 403 without `role.read`, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listRoles(userId, orgId));
};

/**
 * Creates a role that grants nothing yet; set its permissions with
 * `PUT /api/v1/roles/{role_id}/permissions`.
 *
 * @auth role.create
 * @body name {string} - Display name, 1 to 255 characters
 * @body weight {number} - Optional. Priority from 1 to 10000, lower first; defaults to 500
 * @returns 201 with the role. 400 for an invalid id or body, 401 when signed out, 403 without `role.create`, 404 when the caller is not a member
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const body = await parseBody(request, createRoleSchema);

	return json(await createRole(userId, orgId, body), { status: 201 });
};
