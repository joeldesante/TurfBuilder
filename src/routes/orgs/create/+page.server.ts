import { redirect } from '@sveltejs/kit';
import { isOrgCreationAllowed } from '$lib/server/services/organizations.service';

export async function load({ locals }) {
	if (!locals.user) throw redirect(303, '/auth/signin');
	if (!(await isOrgCreationAllowed())) throw redirect(303, '/orgs');
}
