import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { replaceRolePermissions } from '$lib/server/services/roles.service';
import { rolePermissionsSchema } from '$lib/shared/schemas/roles';

/**
 * Makes the role grant exactly the keys sent. The administrator role (weight 0)
 * keeps `system.access` even when it is left out.
 *
 * @auth role.update
 * @body permissions {string[]} - Every `resource.action` key the role grants
 * @returns The role. 400 for an invalid id, body, or unknown key, 401 when signed out, 403 without `role.update`, 404 when it is not in the caller's organizations
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const roleId = parseId(params.role_id, 'role');
	const { permissions } = await parseBody(request, rolePermissionsSchema);

	return json(await replaceRolePermissions(userId, roleId, permissions));
};
