import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { queryBucketEntitiesPage } from '$lib/server/services/buckets.service';
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
	const { bucket } = await parent();

	if (!bucket.filters) throw error(422, bucket.problem);

	const group = bucket.filters.people;
	if (!group) {
		return { people: [] as PersonRow[], enabled: false, totalCount: 0, page: 1, pageSize: PAGE_SIZE };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await queryBucketEntitiesPage(client, locals.organization!.id, 'people', group, requestedPage(url));
		return {
			people: result.items as unknown as PersonRow[],
			enabled: true,
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize
		};
	});
}
