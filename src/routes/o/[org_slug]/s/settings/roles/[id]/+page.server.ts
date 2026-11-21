import { error } from '@sveltejs/kit';
import { parseId } from '$lib/server/list-access';
import { getRole } from '$lib/server/services/roles.service';

export async function load({ params, locals }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	const role = await getRole(locals.user.id, parseId(params.id, 'role'));
	// The URL names the org too; a role from another of the caller's orgs is not this page's.
	if (role.organization_id !== locals.organization.id) throw error(404, 'Role not found.');

	return { role: { ...role, is_admin: role.weight === 0 } };
}
