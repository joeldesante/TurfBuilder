import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getMemberDetail } from '$lib/server/services/members.service';

export async function load({ params, locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!can(locals.organization, 'member', 'read')) throw error(403, 'Forbidden.');

	const detail = await getMemberDetail(locals.user.id, locals.organization!.id, params.user_id);

	return { ...detail, canManagePerms: can(locals.organization, 'member', 'update') };
}
