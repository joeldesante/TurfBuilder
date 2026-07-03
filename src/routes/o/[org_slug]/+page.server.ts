import { redirect } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';



export async function load({ locals, params }) {
	
	// Staff users go straight to the staff dashboard.
	if (!can(locals.organization, 'system', 'access')) {
		return;
	}

	if (locals.organization?.role) {
		throw redirect(303, `/o/${params.org_slug}/s/`);
	}
}
