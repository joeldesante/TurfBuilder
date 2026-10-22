import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import LineChart from './LineChart.svelte';
import { activeUsers, signups } from '../fixtures';

describe('LineChart', () => {
	test('draws a line per series with a summary for screen readers', async () => {
		const { container } = render(LineChart, { props: { title: 'Active users', series: activeUsers } });

		const chart = page.getByRole('img', { name: /Active users, Aug 1, 2026 to Sep 29, 2026/ });
		await expect.element(chart).toBeVisible();
		expect(container.querySelectorAll('path[stroke-width="2"]')).toHaveLength(3);
	});

	test('has a data table for screen readers', async () => {
		render(LineChart, { props: { title: 'New accounts', series: signups } });

		await expect.element(page.getByRole('table', { name: 'New accounts' })).toBeInTheDocument();
		await expect.element(page.getByRole('rowheader', { name: 'Aug 1, 2026' })).toBeInTheDocument();
	});

	test('the legend hides and shows a series', async () => {
		const { container } = render(LineChart, { props: { title: 'Active users', series: activeUsers } });

		const toggle = page.getByRole('button', { name: /Weekly active/ });
		await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
		await toggle.click();
		await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
		expect(container.querySelectorAll('path[stroke-width="2"]')).toHaveLength(2);
	});

	test('a single series needs no legend', async () => {
		render(LineChart, { props: { title: 'New accounts', series: signups } });

		await expect.element(page.getByRole('button', { name: /^New accounts/ })).not.toBeInTheDocument();
	});

	test('arrow keys move a crosshair and announce the values', async () => {
		render(LineChart, { props: { title: 'New accounts', series: signups } });

		const chart = page.getByRole('img', { name: /New accounts/ });
		// Focus rather than click: a click is also a hover, which moves the crosshair.
		(chart.element() as SVGElement).focus();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(page.getByText(/^Aug 1, 2026: New accounts \d+/)).toBeInTheDocument();
	});

	test('says so when there is nothing to draw', async () => {
		render(LineChart, { props: { title: 'New accounts', series: [], emptyText: 'No sign-ups yet.' } });

		await expect.element(page.getByText('No sign-ups yet.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Download/ })).not.toBeInTheDocument();
	});

	test('shows an error in place of the chart', async () => {
		render(LineChart, { props: { title: 'New accounts', series: signups, error: 'Could not load.' } });

		await expect.element(page.getByRole('alert')).toHaveTextContent('Could not load.');
	});

	test('offers the data as CSV', async () => {
		render(LineChart, { props: { title: 'New accounts', series: signups } });

		await expect.element(page.getByRole('button', { name: 'Download New accounts as CSV' })).toBeVisible();
	});
});
