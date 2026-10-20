import { render } from 'vitest-browser-svelte';
import { describe, expect, test, vi } from 'vitest';
import InfraMetricsPage from './InfraMetricsPage.svelte';
import { metrics } from './fixtures';

describe('InfraMetricsPage', () => {
	test('groups the charts into sections', async () => {
		const { getByRole } = render(InfraMetricsPage, { props: { metrics, onrange: vi.fn() } });

		for (const name of ['Growth', 'Engagement', 'Field activity', 'Breakdowns']) {
			await expect.element(getByRole('heading', { name })).toBeVisible();
		}
	});

	test('draws every kind of chart', async () => {
		const { getByRole } = render(InfraMetricsPage, { props: { metrics, onrange: vi.fn() } });

		await expect.element(getByRole('img', { name: /^New accounts/ })).toBeVisible();
		await expect.element(getByRole('img', { name: /^Most active organizations/ })).toBeVisible();
		await expect.element(getByRole('img', { name: /^Sign-in methods/ })).toBeVisible();
		await expect.element(getByRole('img', { name: /^Weekly retention/ })).toBeVisible();
	});

	test('links each top organization to its page', async () => {
		const { getByRole } = render(InfraMetricsPage, { props: { metrics, onrange: vi.fn() } });

		await expect.element(getByRole('link', { name: /Riverside Canvass/ })).toHaveAttribute('href', '/infra/orgs/a');
	});

	test('reports the new range, with its usual granularity', async () => {
		const onrange = vi.fn();
		const { getByRole } = render(InfraMetricsPage, { props: { metrics, onrange } });

		await getByRole('radio', { name: '1 year' }).click();
		expect(onrange).toHaveBeenCalledWith({ range: '1y', granularity: 'month' });
	});
});
