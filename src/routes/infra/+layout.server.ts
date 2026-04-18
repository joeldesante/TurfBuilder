import { redirect, error } from '@sveltejs/kit';
import { resolveInfraPermissions } from '$lib/server/permissions';

export async function load({ locals, parent }) {
	const parentData = await parent();

	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	const infraPermissions = await resolveInfraPermissions(locals.user.id);

	if (!infraPermissions.includes('access')) {
		throw error(403, 'Infrastructure access required.');
	}

	return {
		...parentData,
		user: locals.user,
		infraPermissions
	};
}
