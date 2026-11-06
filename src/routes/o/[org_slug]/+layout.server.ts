import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	// locals.organization is set by hooks.server.ts.
	// If it's undefined the slug doesn't exist or the user isn't a member.
	if (!locals.organization) {
		throw redirect(303, '/orgs');
	}

	return {
		user: locals.user,
		organization: locals.organization
	};
}
