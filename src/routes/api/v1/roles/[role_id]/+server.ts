import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { deleteRole, getRole, renameRole } from '$lib/server/services/roles.service';
import { updateRoleSchema } from '$lib/shared/schemas/roles';

/**
 * One permission role with the keys it grants.
 *
 * @auth role.read
 * @returns `{ id, name, is_default, weight, permissions: string[] }`. 400 for an invalid id, 401 when signed out, 403 without `role.read`, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await getRole(userId, parseId(params.role_id, 'role')));
};

/**
 * Renames a role.
 *
 * @auth role.update
 * @body name {string} - Display name, 1 to 255 characters
 * @returns The role. 400 for an invalid id or body, 401 when signed out, 403 without `role.update`, 404 when it is not in the caller's organizations, 409 for the default role
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const roleId = parseId(params.role_id, 'role');
	const { name } = await parseBody(request, updateRoleSchema);

	return json(await renameRole(userId, roleId, name));
};

/**
 * Deletes a role. Its members keep any other roles they hold.
 *
 * @auth role.delete
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without `role.delete`, 404 when it is not in the caller's organizations, 409 for the default role
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await deleteRole(userId, parseId(params.role_id, 'role'));
	return new Response(null, { status: 204 });
};
