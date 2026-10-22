import { requestedPage } from '$lib/shared/utils/pagination';
import { orgFiltersFromUrl } from '$lib/shared/schemas/platform-organizations';
import { listOrgs } from '$lib/server/services/platform-organizations.service';

export async function load({ locals, url }) {
	const filters = orgFiltersFromUrl(url);
	return { filters, page: await listOrgs(locals.user!.id, filters, requestedPage(url)) };
}
