import { error } from '@sveltejs/kit';
import { requestedPage } from '$lib/shared/utils/pagination';
import { listOrgPeople } from '$lib/server/services/people.service';

export async function load({ locals, url }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	const result = await listOrgPeople(locals.user.id, locals.organization.id, requestedPage(url));

	return {
		people: result.items,
		totalCount: result.totalCount,
		page: result.page,
		pageSize: result.pageSize
	};
}
