import { withOrgTransaction } from '$lib/server/database';
import { queryBucketEntitiesPage } from '$lib/server/services/buckets.service';
import { PAGE_SIZE, requestedPage } from '$lib/shared/utils/pagination';

export interface LocationRow {
	id: string;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
}

export async function load({ parent, locals, url }) {
	const { bucket } = await parent();

	const group = bucket.filters.locations;
	if (!group) {
		return { locations: [] as LocationRow[], enabled: false, totalCount: 0, page: 1, pageSize: PAGE_SIZE };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await queryBucketEntitiesPage(client, 'locations', group, requestedPage(url));
		return {
			locations: result.items as unknown as LocationRow[],
			enabled: true,
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize
		};
	});
}
