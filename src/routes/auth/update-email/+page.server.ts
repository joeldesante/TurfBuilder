import { isPlaceholderEmail } from '$lib/server/utils/placeholder-email';
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	// Only users with fake emails should be here
	if (!isPlaceholderEmail(locals.user.email)) {
		throw redirect(303, '/');
	}

	return {};
}
