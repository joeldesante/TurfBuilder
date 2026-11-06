import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	throw redirect(303, '/orgs');
}
