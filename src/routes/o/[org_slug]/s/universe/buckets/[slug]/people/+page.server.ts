import { withOrgTransaction } from '$lib/server/database';
import { BUCKET_PAGE_SIZE, fetchBucketEntityPage } from '$lib/server/bucket-query';

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

	if (!bucket.filter.people.enabled || !bucket.filter.people.query) {
		return { people: [] as PersonRow[], enabled: false, totalCount: 0, page: 1, pageSize: BUCKET_PAGE_SIZE };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await fetchBucketEntityPage(client, bucket.filter.people.query!, {
			requestedPage: Number(url.searchParams.get('page')),
			orderBy: 'last_name NULLS LAST, first_name NULLS LAST, id'
		});
		return {
			people: result.rows as unknown as PersonRow[],
			enabled: true,
			totalCount: result.totalCount,
			page: result.page,
			pageSize: result.pageSize
		};
	});
}
