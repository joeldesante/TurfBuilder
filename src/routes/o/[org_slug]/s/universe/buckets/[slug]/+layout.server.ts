import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { countBucketEntities, findBucketForPage } from '$lib/server/services/buckets.service';

export async function load({ params, locals }) {
	if (!locals.organization) {
		throw error(401, 'Unauthorized');
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		const bucket = await findBucketForPage(client, locals.organization!.id, params.slug);
		if (!bucket) throw error(404, 'Bucket not found');

		const locations = bucket.filters?.locations;
		const locationCount = locations ? await countBucketEntities(client, 'locations', locations) : null;

		return { bucket, locationCount };
	});
}
