import { error } from '@sveltejs/kit';
import { listBucketScripts } from '$lib/server/services/scripts.service';

export async function load({ locals, parent }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const { bucket } = await parent();
	return { scripts: await listBucketScripts(locals.user.id, bucket.id) };
}
