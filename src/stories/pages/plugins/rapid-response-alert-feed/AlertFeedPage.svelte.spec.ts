import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import AlertFeedPage from './AlertFeedPage.svelte';
import type { Alert } from './AlertFeedPage.svelte';

const sampleAlerts: Alert[] = [
	{
		id: '1',
		title: 'Polling location change in Ward 4',
		body: 'The polling location at Lincoln Elementary has moved to the community center.',
		category: 'urgent',
		author: 'Maria Gonzalez',
		publishedAt: new Date(Date.now() - 45 * 60_000).toISOString()
	},
	{
		id: '2',
		title: 'Canvassing hours extended tonight',
		body: 'We have received permission to canvass until 8 PM.',
		category: 'update',
		author: 'James Okafor',
		publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString()
	},
	{
		id: '3',
		title: 'Weekend training session',
		body: 'A refresher training will be held Saturday at 10 AM.',
		category: 'info',
		author: 'Sarah Kim',
		publishedAt: new Date(Date.now() - 26 * 3600_000).toISOString()
	}
];

describe('AlertFeedPage', () => {
	it('renders the page heading', async () => {
		render(AlertFeedPage, { alerts: sampleAlerts });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Alert Feed');
	});

	it('renders each alert title', async () => {
		render(AlertFeedPage, { alerts: sampleAlerts });
		await expect.element(page.getByText('Polling location change in Ward 4')).toBeVisible();
		await expect.element(page.getByText('Canvassing hours extended tonight')).toBeVisible();
		await expect.element(page.getByText('Weekend training session')).toBeVisible();
	});

	it('renders each alert body', async () => {
		render(AlertFeedPage, { alerts: sampleAlerts });
		await expect
			.element(page.getByText('The polling location at Lincoln Elementary has moved to the community center.'))
			.toBeVisible();
	});

	it('renders each alert author', async () => {
		render(AlertFeedPage, { alerts: sampleAlerts });
		await expect.element(page.getByText('— Maria Gonzalez')).toBeVisible();
	});

	it('renders category badges', async () => {
		render(AlertFeedPage, { alerts: sampleAlerts });
		await expect.element(page.getByText('Urgent')).toBeVisible();
		await expect.element(page.getByText('Update')).toBeVisible();
		await expect.element(page.getByText('Info')).toBeVisible();
	});

	it('shows empty state when no alerts', async () => {
		render(AlertFeedPage, { alerts: [] });
		await expect
			.element(page.getByText('No alerts have been published.'))
			.toBeVisible();
	});
});
