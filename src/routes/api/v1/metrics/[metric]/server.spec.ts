import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPlatformMetric } = vi.hoisted(() => ({ getPlatformMetric: vi.fn() }));
vi.mock('$lib/server/services/platform-metrics.service', () => ({ getPlatformMetric }));

import { GET } from './+server';

const signedIn = { user: { id: 'u1' } };
const window = { range: '30d', granularity: 'day', from: 'a', to: 'b' };

function get(metric: string, query = '', locals: unknown = signedIn) {
	return GET({ params: { metric }, locals, url: new URL(`http://x/api/v1/metrics/${metric}${query}`) } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	getPlatformMetric.mockResolvedValue({
		window,
		metric: {
			kind: 'series',
			title: 'New accounts',
			format: 'number',
			series: [{ key: 's', label: 'New accounts', points: [{ date: '2026-10-01', value: 4 }] }]
		}
	});
});

describe('GET /api/v1/metrics/[metric]', () => {
	it('answers 401 when signed out', async () => {
		await expect(get('signups', '', {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an unknown metric', async () => {
		await expect(get('passwords')).rejects.toMatchObject({ status: 400 });
		expect(getPlatformMetric).not.toHaveBeenCalled();
	});

	it('passes the range and granularity', async () => {
		const res = await get('signups', '?range=1y&granularity=month');
		expect(getPlatformMetric).toHaveBeenCalledWith('u1', 'signups', '1y', 'month');
		expect((await res.json()).window).toEqual(window);
	});

	it('defaults to 30 days by day', async () => {
		await get('signups');
		expect(getPlatformMetric).toHaveBeenCalledWith('u1', 'signups', '30d', 'day');
	});

	it('serves CSV as a download', async () => {
		const res = await get('signups', '?range=7d&format=csv');
		expect(res.headers.get('content-type')).toContain('text/csv');
		expect(res.headers.get('content-disposition')).toContain('signups-7d.csv');
		expect(await res.text()).toBe('date,New accounts\n2026-10-01,4');
	});
});
