import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { expect, test, vi } from 'vitest';
import UniverseDataManagerPage from './UniverseDataManagerPage.svelte';

test('renders heading', async () => {
	const { getByRole } = render(UniverseDataManagerPage);
	await expect.element(getByRole('heading', { name: 'Universe Data Manager' })).toBeVisible();
});

test('renders people and locations section headings', async () => {
	const { getByRole } = render(UniverseDataManagerPage);
	await expect.element(getByRole('heading', { name: 'People' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Locations' })).toBeVisible();
});

test('displays people and locations record counts', async () => {
	const { getByText } = render(UniverseDataManagerPage, {
		props: { peopleCount: 1452, locationsCount: 834 }
	});
	await expect.element(getByText('1,452 records')).toBeVisible();
	await expect.element(getByText('834 records')).toBeVisible();
});

test('shows singular label for one record', async () => {
	render(UniverseDataManagerPage, {
		props: { peopleCount: 1, locationsCount: 0 }
	});
	await expect.element(page.getByText('1 record')).toBeVisible();
});

test('import CSV buttons are present when callbacks provided', async () => {
	const onImportPeople = vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] });
	const onImportLocations = vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] });

	render(UniverseDataManagerPage, {
		props: { onImportPeople, onImportLocations }
	});

	await expect.element(page.getByRole('button', { name: /import csv/i }).nth(0)).toBeVisible();
	await expect.element(page.getByRole('button', { name: /import csv/i }).nth(1)).toBeVisible();
});

test('import buttons are disabled when no callbacks provided', async () => {
	render(UniverseDataManagerPage, {
		props: { peopleCount: 0, locationsCount: 0 }
	});

	await expect.element(page.getByRole('button', { name: /import csv/i }).nth(0)).toBeDisabled();
	await expect.element(page.getByRole('button', { name: /import csv/i }).nth(1)).toBeDisabled();
});
