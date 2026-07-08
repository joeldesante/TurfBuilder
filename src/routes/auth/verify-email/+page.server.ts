import { redirect } from '@sveltejs/kit';
import { isEmailVerificationDisabled } from '$lib/server/security';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	// Fake-email users must update their email first
	if (locals.user.email.endsWith('@fake.com')) {
		throw redirect(303, '/auth/update-email');
	}

	// Already verified (or verification is disabled) — nothing to do here
	if (locals.user.emailVerified || isEmailVerificationDisabled()) {
		throw redirect(303, '/');
	}

	return { email: locals.user.email };
}
