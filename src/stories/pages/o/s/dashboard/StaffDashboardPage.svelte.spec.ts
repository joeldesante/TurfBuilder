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

	test('lists the map layers, all off to start', async () => {
		render(StaffDashboardPage, {
			orgSlug: 'north-west-philly-alliance',
			buckets: [],
			mapPoints: [],
			mapLayers: [
				{
					id: 'l1',
					name: 'Wards',
					color: '#2f6fed',
					label_field: null,
					position: 0,
					created_at: '2026-11-16T00:00:00Z',
					updated_at: '2026-11-16T00:00:00Z'
				}
			],
			progress: { total: 0, visited: 0, conversations: 0, visits: 0, answeredVisits: 0, recentConversations: 0 }
		});
		await page.getByRole('button', { name: 'Layers' }).click();
		// Off until asked for: its shapes are only fetched when it is turned on.
		await expect.element(page.getByRole('checkbox', { name: 'Wards' })).not.toBeChecked();
	});
});
