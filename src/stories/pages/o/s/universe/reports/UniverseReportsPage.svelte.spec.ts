import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseReportsPage from './UniverseReportsPage.svelte';

test('renders heading', async () => {
	const { getByRole } = render(UniverseReportsPage, { props: { orgSlug: 'test-org' } });
	await expect.element(getByRole('heading', { name: 'Reports' })).toBeVisible();
});

test('renders all report cards', async () => {
	const { getByRole } = render(UniverseReportsPage, { props: { orgSlug: 'test-org' } });
	await expect.element(getByRole('heading', { name: 'Canvassing Activity' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Survey Results' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Volunteer Activity' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Turf Coverage' })).toBeVisible();
});

test('cards link to correct report routes', async () => {
	const { getByRole } = render(UniverseReportsPage, { props: { orgSlug: 'test-org' } });
	const link = getByRole('link', { name: /Canvassing Activity/ });
	await expect.element(link).toHaveAttribute('href', '/o/test-org/s/universe/reports/canvassing-activity');
});
