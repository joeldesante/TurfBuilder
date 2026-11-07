import { error } from '@sveltejs/kit';
import { listBucketPeople } from '$lib/server/services/buckets.service';
import { PAGE_SIZE, requestedPage } from '$lib/shared/utils/pagination';

export interface PersonRow {
	id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	phone: string | null;
	dob: Date | null;
}

export async function load({ parent, locals, url }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { bucket } = await parent();
	if (!bucket.filters) throw error(422, bucket.problem);

	if (!bucket.filters.people) {
		return {
			people: [] as PersonRow[],
			enabled: false,
			totalCount: 0,
			page: 1,
			pageSize: PAGE_SIZE
		};
	}

	const result = await listBucketPeople(locals.user.id, bucket.id, requestedPage(url));
	return {
		people: result.items as unknown as PersonRow[],
		enabled: true,
		totalCount: result.totalCount,
		page: result.page,
		pageSize: result.pageSize
	};
}
