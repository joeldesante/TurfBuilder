import { error } from '@sveltejs/kit';
import { parseId } from '$lib/server/list-access';
import { getPerson } from '$lib/server/services/people.service';

export async function load({ params, locals }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	return {
		person: await getPerson(locals.user.id, locals.organization.id, parseId(params.id, 'person'))
	};
}
