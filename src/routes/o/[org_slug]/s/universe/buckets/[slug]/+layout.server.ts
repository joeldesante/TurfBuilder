import { error } from '@sveltejs/kit';
import { countBucketLocations, getBucketPage } from '$lib/server/services/buckets.service';
import { logger } from '$lib/server/logger';

export async function load({ params, locals }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	const { bucket } = await getBucketPage(locals.user.id, locals.organization.id, params.slug);

	// The sidebar badge's count is sent when it is ready rather than awaited: counting a large
	// bucket takes a moment, and the page should not wait for a number in the sidebar.
	const locationCount = bucket.filters?.locations
		? countBucketLocations(locals.user.id, bucket.id).catch((err) => {
				logger.error({ err, bucketId: bucket.id }, 'Counting bucket locations failed; the badge is left off');
				return null;
			})
		: Promise.resolve(null);

	return { bucket, locationCount };
}
