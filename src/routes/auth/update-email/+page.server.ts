import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	// Only users with fake emails should be here
	if (!locals.user.email.endsWith('@fake.com')) {
		throw redirect(303, '/');
	}

	return {};
}
