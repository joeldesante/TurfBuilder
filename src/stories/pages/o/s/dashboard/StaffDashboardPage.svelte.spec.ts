import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import StaffDashboardPage from './StaffDashboardPage.svelte';

const baseProps = {
	orgSlug: 'north-west-philly-alliance',
	applicationName: 'TurfBuilder',
	// Without mock data the page fetches /o/{slug}/s/api/dashboard.
	mockTimeSeries: []
};

describe('StaffDashboardPage', () => {
	test('renders the Dashboard heading', async () => {
		render(StaffDashboardPage, baseProps);
		await expect.element(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});

	test('offers each date range and highlights the selected one', async () => {
		render(StaffDashboardPage, baseProps);

		for (const label of ['1 Week', '1 Month', '3 Months', '6 Months', '1 Year']) {
			await expect.element(page.getByRole('button', { name: label })).toBeVisible();
		}
		// initialRange defaults to 1 month.
		await expect.element(page.getByRole('button', { name: '1 Month' })).toHaveClass(/bg-primary/);

		await page.getByRole('button', { name: '1 Week' }).click();
		await expect.element(page.getByRole('button', { name: '1 Week' })).toHaveClass(/bg-primary/);
		await expect
			.element(page.getByRole('button', { name: '1 Month' }))
			.not.toHaveClass(/bg-primary/);
	});
});
