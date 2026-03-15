import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import StaffAlertFeedPage from './StaffAlertFeedPage.svelte';
import type { Alert } from './AlertFeedPage.svelte';

const sampleAlerts: Alert[] = [
	{
		id: '1',
		title: 'Polling location change in Ward 4',
		body: 'The polling location has moved.',
		category: 'urgent',
		author: 'Maria Gonzalez',
		publishedAt: new Date(Date.now() - 45 * 60_000).toISOString()
	},
	{
		id: '2',
		title: 'Canvassing hours extended tonight',
		body: 'We have permission to canvass until 8 PM.',
		category: 'update',
		author: 'James Okafor',
		publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString()
	}
];

const baseProps = {
	alerts: sampleAlerts,
	onPublish: vi.fn().mockResolvedValue(undefined),
	onDelete: vi.fn().mockResolvedValue(undefined)
};

describe('StaffAlertFeedPage', () => {
	it('renders the page heading', async () => {
		render(StaffAlertFeedPage, baseProps);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Alert Feed');
	});

	it('renders the compose form', async () => {
		render(StaffAlertFeedPage, baseProps);
		await expect.element(page.getByLabelText('Title')).toBeVisible();
		await expect.element(page.getByLabelText('Message')).toBeVisible();
		await expect.element(page.getByLabelText('Category')).toBeVisible();
	});

	it('renders each alert title', async () => {
		render(StaffAlertFeedPage, baseProps);
		await expect.element(page.getByText('Polling location change in Ward 4')).toBeVisible();
		await expect.element(page.getByText('Canvassing hours extended tonight')).toBeVisible();
	});

	it('renders delete buttons for each alert', async () => {
		render(StaffAlertFeedPage, baseProps);
		const deleteButtons = page.getByRole('button', { name: 'Delete' });
		await expect.element(deleteButtons.first()).toBeVisible();
	});

	it('calls onPublish with alert data when form is submitted', async () => {
		const onPublish = vi.fn().mockResolvedValue(undefined);
		render(StaffAlertFeedPage, { ...baseProps, onPublish });

		await page.getByLabelText('Title').fill('Test alert title');
		await page.getByLabelText('Message').fill('Test alert body');
		await page.getByRole('button', { name: 'Publish Alert' }).click();

		expect(onPublish).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Test alert title', body: 'Test alert body' })
		);
	});

	it('calls onDelete with alert id when delete is clicked', async () => {
		const onDelete = vi.fn().mockResolvedValue(undefined);
		render(StaffAlertFeedPage, { ...baseProps, onDelete });

		await page.getByRole('button', { name: 'Delete' }).first().click();
		expect(onDelete).toHaveBeenCalledWith('1');
	});

	it('shows empty state when no alerts', async () => {
		render(StaffAlertFeedPage, { ...baseProps, alerts: [] });
		await expect
			.element(page.getByText('No alerts have been published yet.'))
			.toBeVisible();
	});

	it('publish button is disabled when title is empty', async () => {
		render(StaffAlertFeedPage, baseProps);
		await expect
			.element(page.getByRole('button', { name: 'Publish Alert' }))
			.toBeDisabled();
	});
});
