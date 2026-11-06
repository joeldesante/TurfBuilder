import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.user) throw redirect(303, '/auth/signin');
	// Only what the account menu shows.
	return { user: { name: locals.user.name, email: locals.user.email } };
}
