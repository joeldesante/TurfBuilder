import { z } from 'zod';
import { parseRange } from '$lib/dashboard-range';
import { PLATFORM_METRICS } from '$lib/shared/types/metrics';

export const metricKeySchema = z.enum(PLATFORM_METRICS);

const granularitySchema = z.enum(['day', 'week', 'month']);

/** The range and granularity in a metrics URL. Missing or bad values fall back to 30 days by day. */
export function metricsWindowFromUrl(url: URL) {
	const rawRange = url.searchParams.get('range');
	const range = rawRange ? parseRange(rawRange) : '30d';
	const granularity = granularitySchema.catch(range === 'all' || range.endsWith('y') ? 'month' : 'day').parse(
		url.searchParams.get('granularity') ?? undefined
	);
	return { range, granularity };
}
