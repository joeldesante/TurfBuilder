import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import CanvassingActivityReportPage from './CanvassingActivityReportPage.svelte';

test('renders heading', async () => {
	const { getByRole } = render(CanvassingActivityReportPage, {
		props: { orgSlug: 'test-org' }
	});
	await expect.element(getByRole('heading', { name: 'Canvassing Activity' })).toBeVisible();
});

test('shows empty state when no activity', async () => {
	const { getByText } = render(CanvassingActivityReportPage, {
		props: { orgSlug: 'test-org', activity: [], totalResponses: 0 }
	});
	await expect.element(getByText('No canvassing activity recorded yet.')).toBeVisible();
});

test('shows activity rows when data provided', async () => {
	const { getByText } = render(CanvassingActivityReportPage, {
		props: {
			orgSlug: 'test-org',
			totalResponses: 10,
			activity: [{ date: '2026-06-25', response_count: 10 }]
		}
	});
	await expect.element(getByText('2026-06-25')).toBeVisible();
});
