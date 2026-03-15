import { redirect } from '@sveltejs/kit';

export async function load({ locals, params }) {
	// Staff users go straight to the staff dashboard.
	if (locals.organization?.role) {
		throw redirect(303, `/o/${params.org_slug}/s/`);
	}
}
