import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { listRoles } from '$lib/server/services/roles.service';

export async function load({ locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!can(locals.organization, 'role', 'read')) throw error(403, 'Forbidden');

	return { roles: await listRoles(locals.user.id, locals.organization!.id) };
}
