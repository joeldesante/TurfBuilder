import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	// Fake-email users must update their email first
	if (locals.user.email.endsWith('@fake.com')) {
		throw redirect(303, '/auth/update-email');
	}

	// Already verified — nothing to do here
	if (locals.user.emailVerified) {
		throw redirect(303, '/');
	}

	return { email: locals.user.email };
}
