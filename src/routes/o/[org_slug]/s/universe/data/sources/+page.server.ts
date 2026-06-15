import { redirect } from '@sveltejs/kit';

export async function load({ params }) {
	throw redirect(301, `/o/${params.org_slug}/s/universe/data/integrations`);
}
