import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import DonutChart from './DonutChart.svelte';
import { longTail, signInMethods } from '../fixtures';

describe('DonutChart', () => {
	test('draws a slice per category and names each share', async () => {
		const { container } = render(DonutChart, { props: { title: 'Sign-in methods', data: signInMethods } });

		await expect.element(page.getByRole('img', { name: /Email and password 812, 71%/ })).toBeVisible();
		expect(container.querySelectorAll('svg[aria-label] g path')).toHaveLength(3);
	});

	test('shows the total in the middle', async () => {
		render(DonutChart, { props: { title: 'Sign-in methods', data: signInMethods } });

		await expect.element(page.getByText('1.1k')).toBeInTheDocument();
		await expect.element(page.getByText('Total')).toBeInTheDocument();
	});

	test('folds a long tail into Other', async () => {
		const { container } = render(DonutChart, { props: { title: 'Events', data: longTail, maxSlices: 5 } });

		expect(container.querySelectorAll('svg[aria-label] g path')).toHaveLength(5);
		await expect.element(page.getByRole('rowheader', { name: 'Other' })).toBeInTheDocument();
	});

	test('skips empty categories and says when everything is zero', async () => {
		render(DonutChart, { props: { title: 'Events', data: [{ key: 'a', label: 'A', value: 0 }] } });

		await expect.element(page.getByText('No data for this period.')).toBeVisible();
	});
});
