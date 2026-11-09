import { error } from '@sveltejs/kit';
import { listBucketLocations } from '$lib/server/services/buckets.service';
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

	if (!bucket.filters) throw error(422, bucket.problem);

	if (!bucket.filters.locations) {
		return {
			locations: [] as LocationRow[],
			enabled: false,
			totalCount: 0,
			page: 1,
			pageSize: PAGE_SIZE
		};
	}

	const result = await listBucketLocations(locals.user!.id, bucket.id, requestedPage(url));
	return {
		locations: result.items as unknown as LocationRow[],
		enabled: true,
		totalCount: result.totalCount,
		page: result.page,
		pageSize: result.pageSize
	};
}
