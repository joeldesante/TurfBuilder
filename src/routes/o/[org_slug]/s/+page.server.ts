import { withOrgTransaction } from '$lib/server/database';
import { getDashboardPoints, getDashboardProgress } from '$lib/server/dashboard';
import { findBucketBySlug } from '$lib/server/services/buckets.service';
import { parseRange } from '$lib/dashboard-range';

export async function load({ parent, locals, url }) {
	await parent();

	// ?bucket=<slug>; none (or an unknown slug) means the entire universe.
	const slug = url.searchParams.get('bucket');
	// ?range=7d|30d; none (or unknown) means all time.
	const range = parseRange(url.searchParams.get('range'));
	const orgId = locals.organization!.id;

	return withOrgTransaction(orgId, async (client) => {
		// A bucket that cannot be read is an error, since showing the whole universe in its place would be wrong.
		const bucket = slug ? await findBucketBySlug(client, orgId, slug) : null;

		return {
			progress: await getDashboardProgress(client, orgId, bucket, range),
			points: await getDashboardPoints(client, orgId, bucket, range)
		};
	});
}
