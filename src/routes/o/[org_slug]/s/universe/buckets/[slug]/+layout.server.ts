import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { findBucketBySlug } from '$lib/server/services/buckets.service';

export async function load({ params, locals }) {
	if (!locals.organization) {
		throw error(401, 'Unauthorized');
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const bucket = await findBucketBySlug(client, locals.organization!.id, params.slug);
		if (!bucket) throw error(404, 'Bucket not found');

		return { bucket };
	});
}
