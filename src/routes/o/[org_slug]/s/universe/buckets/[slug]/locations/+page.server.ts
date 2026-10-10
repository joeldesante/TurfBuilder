import { withOrgTransaction } from '$lib/server/database';
import { BUCKET_LOCATION_ORDER, fetchBucketEntityPage } from '$lib/server/bucket-query';
import { PAGE_SIZE, requestedPage } from '$lib/server/pagination';

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

	if (!bucket.filter.locations.enabled || !bucket.filter.locations.query) {
		return { locations: [] as LocationRow[], enabled: false, totalCount: 0, page: 1, pageSize: PAGE_SIZE };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await fetchBucketEntityPage(client, bucket.filter.locations.query!, {
			requestedPage: requestedPage(url),
			orderBy: BUCKET_LOCATION_ORDER
		});
		return {
			locations: result.items as unknown as LocationRow[],
			enabled: true,
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize
		};
	});
}
