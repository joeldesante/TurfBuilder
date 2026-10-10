import { withOrgTransaction } from '$lib/server/database';
import { BUCKET_PAGE_SIZE, fetchBucketEntityPage } from '$lib/server/bucket-query';

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
		return { locations: [] as LocationRow[], enabled: false, totalCount: 0, page: 1, pageSize: BUCKET_PAGE_SIZE };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await fetchBucketEntityPage(client, bucket.filter.locations.query!, {
			requestedPage: Number(url.searchParams.get('page')),
			orderBy: 'name NULLS LAST, address_line_1 NULLS LAST, id'
		});
		return {
			locations: result.rows as unknown as LocationRow[],
			enabled: true,
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize
		};
	});
}
