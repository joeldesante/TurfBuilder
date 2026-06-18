import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;
export const ssr = false;


export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/auth/signin');
	if (!locals.organization) throw redirect(303, '/orgs');
	if (!locals.organization.role) throw error(403, 'Forbidden');
	return { orgSlug: params.org_slug };
};
