import { listBucketLists } from '$lib/server/services/lists.service';

export async function load({ parent, locals }) {
	const { bucket } = await parent();

	return { lists: await listBucketLists(locals.user!.id, bucket.id) };
}
