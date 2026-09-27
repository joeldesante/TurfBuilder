import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import StaffDashboardPage from './StaffDashboardPage.svelte';

describe('StaffDashboardPage', () => {
	test('renders the dashboard sections', async () => {
		render(StaffDashboardPage, {
			orgSlug: 'north-west-philly-alliance',
			buckets: [],
			mapPoints: [],
			progress: { total: 0, visited: 0, conversations: 0, visits: 0, answeredVisits: 0, recentConversations: 0 }
		});
		await expect.element(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		await expect.element(page.getByText('Locations visited')).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Where canvassers have been' })).toBeVisible();
	});
});
