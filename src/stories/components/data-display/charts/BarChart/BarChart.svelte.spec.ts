import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import BarChart from './BarChart.svelte';
import { topOrgs, visitsStack } from '../fixtures';

describe('BarChart', () => {
	test('ranks categories with their values', async () => {
		const { container } = render(BarChart, { props: { title: 'Top orgs', data: topOrgs } });

		await expect.element(page.getByRole('img', { name: /Top orgs\. Riverside Canvass 2,140/ })).toBeVisible();
		expect(container.querySelectorAll('svg[aria-label^="Top orgs"] path')).toHaveLength(topOrgs.length);
		await expect.element(page.getByText('2.1k')).toBeInTheDocument();
	});

	test('truncates long labels but keeps the full one in the table', async () => {
		render(BarChart, { props: { title: 'Top orgs', data: topOrgs } });

		await expect.element(page.getByText('Lakeview Neighbors for…', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByRole('rowheader', { name: 'Lakeview Neighbors for Better Transit' })).toBeInTheDocument();
	});

	test('links labels when given an href', async () => {
		render(BarChart, { props: { title: 'Top orgs', data: topOrgs, href: (d: { key: string }) => `/infra/orgs/${d.key}` } });

		const link = page.getByRole('img', { name: /^Top orgs/ }).element().querySelector('a');
		expect(link?.getAttribute('href')).toBe('/infra/orgs/a');
	});

	test('stacks series over time with a legend that toggles them', async () => {
		const { container } = render(BarChart, { props: { title: 'Visits', series: visitsStack } });

		const before = container.querySelectorAll('svg[aria-label^="Visits"] path').length;
		await page.getByRole('button', { name: /No answer/ }).click();
		expect(container.querySelectorAll('svg[aria-label^="Visits"] path').length).toBeLessThan(before);
	});

	test('says so when there is nothing', async () => {
		render(BarChart, { props: { title: 'Top orgs', data: [], emptyText: 'Nothing yet.' } });

		await expect.element(page.getByText('Nothing yet.')).toBeVisible();
	});
});
