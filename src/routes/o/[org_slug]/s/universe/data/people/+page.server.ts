import { withOrgTransaction } from '$lib/server/database';
import { requestedPage } from '$lib/server/pagination';
import { queryOrgPeoplePage } from '$lib/server/services/people.service';

export async function load({ locals, url }) {
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		const result = await queryOrgPeoplePage(client, orgId, requestedPage(url));

		return {
			people: result.items,
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize
		};
	});
}
