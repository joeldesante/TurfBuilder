import { getPlatformOverview } from '$lib/server/services/platform-metrics.service';

export async function load({ locals }) {
	return { overview: await getPlatformOverview(locals.user!.id) };
}
