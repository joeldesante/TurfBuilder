import { redirect, error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';

export async function load({ locals, parent }) {
	const parentData = await parent();

	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	if (!locals.organization) {
		throw redirect(303, '/orgs');
	}

	// A user must have an assigned org role to access staff pages.
	// Owner roles bypass all permission checks; other roles need at least one permission.
	if (!locals.organization.role) {
		throw error(403, 'You do not have staff access to this organization.');
	}

	return {
		...parentData,
		organization: locals.organization
	};
}
