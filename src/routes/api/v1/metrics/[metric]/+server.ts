import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { metricKeySchema, metricsWindowFromUrl } from '$lib/shared/schemas/metrics';
import { getPlatformMetric } from '$lib/server/services/platform-metrics.service';
import { categoriesToCsv, seriesToCsv } from '$lib/shared/utils/chart-series';
import type { MetricResult } from '$lib/shared/types/metrics';

function toCsv(metric: MetricResult): string {
	if (metric.kind === 'series') return seriesToCsv(metric.series);
	if (metric.kind === 'categories') return categoriesToCsv(metric.data);
	const lookup = new Map(metric.cells.map((c) => [`${c.row}|${c.col}`, c.value]));
	return [
		['row', ...metric.cols].join(','),
		...metric.rows.map((row) => [row, ...metric.cols.map((col) => lookup.get(`${row}|${col}`) ?? '')].join(','))
	].join('\n');
}

/**
 * One platform metric over a time range, as chart data or CSV.
 *
 * @auth infra access
 * @query range {string} - Optional. 7d, 30d, 90d, 1y, all, or any dashboard range. Default 30d
 * @query granularity {'day'|'week'|'month'} - Optional. Coarsened for long ranges
 * @query format {'json'|'csv'} - Optional. Default json
 * @returns `{ window, metric }`, or a CSV file. 400 for an unknown metric, 401 when signed out, 403 without infra access
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const metric = metricKeySchema.safeParse(params.metric);
	if (!metric.success) throw error(400, 'Unknown metric');

	const { range, granularity } = metricsWindowFromUrl(url);
	const result = await getPlatformMetric(userId, metric.data, range, granularity);

	if (url.searchParams.get('format') === 'csv') {
		return new Response(toCsv(result.metric), {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="${metric.data}-${range}.csv"`
			}
		});
	}
	return json(result);
};
