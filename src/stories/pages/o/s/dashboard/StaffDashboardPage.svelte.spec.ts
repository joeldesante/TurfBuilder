import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import StaffDashboardPage from './StaffDashboardPage.svelte';

const baseProps = {
	orgSlug: 'north-west-philly-alliance',
	applicationName: 'TurfBuilder'
};

describe('StaffDashboardPage', () => {
	test('renders the Dashboard heading', async () => {
		render(StaffDashboardPage, baseProps);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
	});

	test('renders the Join a Turf button linking to the correct org URL', async () => {
		render(StaffDashboardPage, baseProps);
		const button = page.getByRole('link', { name: 'Join a Turf' });
		await expect.element(button).toBeVisible();
		await expect.element(button).toHaveAttribute('href', '/o/north-west-philly-alliance/join');
	});
});
