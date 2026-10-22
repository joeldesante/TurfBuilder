import { requestedPage } from '$lib/shared/utils/pagination';
import { userFiltersFromUrl } from '$lib/shared/schemas/platform-users';
import { listUsers } from '$lib/server/services/platform-users.service';

export async function load({ locals, url }) {
	const filters = userFiltersFromUrl(url);
	return { filters, page: await listUsers(locals.user!.id, filters, requestedPage(url)) };
}
