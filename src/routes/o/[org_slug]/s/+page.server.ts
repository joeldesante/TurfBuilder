import { withOrgTransaction } from '$lib/server/database';
import { getDashboardPoints, getDashboardProgress } from '$lib/server/dashboard';
import { parseRange } from '$lib/dashboard-range';

export async function load({ parent, locals, url }) {
	const { buckets } = await parent();

	// ?bucket=<slug>; none (or an unknown slug) means the entire universe.
	const slug = url.searchParams.get('bucket');
	const bucket = buckets.find((b) => b.slug === slug) ?? null;
	// ?range=7d|30d; none (or unknown) means all time.
	const range = parseRange(url.searchParams.get('range'));

	const { progress, points } = await withOrgTransaction(locals.organization!.id, async (client) => ({
		progress: await getDashboardProgress(client, locals.organization!.id, bucket, range),
		points: await getDashboardPoints(client, locals.organization!.id, bucket, range)
	}));

	return { progress, points };
}
