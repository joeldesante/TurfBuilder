import { json } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

const RANGE_INTERVALS: Record<string, string> = {
	'1w': '7 days',
	'1m': '1 month',
	'3m': '3 months',
	'6m': '6 months',
	'1y': '1 year'
};

/**
 * Returns dashboard analytics for the organization.
 *
 * @auth staff
 * @query range {string} One of: 1w, 1m, 3m, 6m, 1y (default: 1m)
 * @returns { timeSeries: { date: string, count: number }[], outcomes: { contact_made: boolean | null, count: number }[] }
 */
export async function GET({ locals, url }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rangeParam = url.searchParams.get('range') ?? '1m';
	const interval = RANGE_INTERVALS[rangeParam];
	if (!interval) {
		return json({ error: 'Invalid range. Must be one of: 1w, 1m, 3m, 6m, 1y' }, { status: 400 });
	}

	try {
		return await withOrgTransaction(locals.organization.id, async (client) => {
			const [timeSeriesResult, outcomesResult] = await Promise.all([
				client.query(
					`SELECT
						date_trunc('day', created_at) AS date,
						COUNT(*)::int AS count
					FROM turf_location_attempt
					WHERE organization_id = $1
					  AND created_at >= now() - $2::interval
					GROUP BY date_trunc('day', created_at)
					ORDER BY date ASC`,
					[locals.organization!.id, interval]
				),
				client.query(
					`SELECT
						contact_made,
						COUNT(*)::int AS count
					FROM turf_location_attempt
					WHERE organization_id = $1
					  AND created_at >= now() - $2::interval
					GROUP BY contact_made`,
					[locals.organization!.id, interval]
				)
			]);

			return json({
				timeSeries: timeSeriesResult.rows,
				outcomes: outcomesResult.rows
			});
		});
	} catch (error) {
		console.error('Error fetching dashboard data:', error);
		return json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
	}
}
