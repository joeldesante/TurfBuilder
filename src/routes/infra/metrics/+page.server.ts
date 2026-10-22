import { metricsWindowFromUrl } from '$lib/shared/schemas/metrics';
import { getPlatformMetrics } from '$lib/server/services/platform-metrics.service';

export async function load({ locals, url }) {
	const { range, granularity } = metricsWindowFromUrl(url);
	return { metrics: await getPlatformMetrics(locals.user!.id, range, granularity) };
}
