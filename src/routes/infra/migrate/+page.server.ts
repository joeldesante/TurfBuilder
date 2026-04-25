import { error } from '@sveltejs/kit';
import { resolveInfraPermissions } from '$lib/server/permissions';

export async function load({ locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const infraPermissions = await resolveInfraPermissions(locals.user.id);
	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	return {};
}
