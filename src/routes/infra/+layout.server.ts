import { redirect, error } from '@sveltejs/kit';
import { isEmailVerificationDisabled } from '$lib/server/security';

export async function load({ locals, parent }) {
	const parentData = await parent();

	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	if (!locals.user.emailVerified && !isEmailVerificationDisabled()) {
		throw redirect(303, '/auth/verify-email');
	}

	// Resolved once per request in hooks.server.ts.
	const infraPermissions = locals.infrastructure?.permissions ?? [];

	if (!infraPermissions.includes('access')) {
		throw error(403, 'Infrastructure access required.');
	}

	return {
		...parentData,
		user: locals.user,
		infraPermissions
	};
}
