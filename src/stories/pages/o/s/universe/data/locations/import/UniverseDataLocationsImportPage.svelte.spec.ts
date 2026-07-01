import { render } from 'vitest-browser-svelte';
import { expect, test, describe } from 'vitest';
import UniverseDataLocationsImportPage from './UniverseDataLocationsImportPage.svelte';

describe('UniverseDataLocationsImportPage', () => {
	test('renders CSV source with file input and choose button', async () => {
		const { getByRole, getByLabelText } = render(UniverseDataLocationsImportPage, {
			props: { orgSlug: 'test-org', source: 'csv' }
		});

		await expect.element(getByRole('heading', { name: 'Import from CSV or Excel' })).toBeVisible();
		await expect.element(getByLabelText('Select CSV or Excel file')).toBeInTheDocument();
		await expect.element(getByRole('button', { name: /choose file/i })).toBeVisible();
	});

	test('renders Google Sheets source with URL input and import button', async () => {
		const { getByRole, getByLabelText } = render(UniverseDataLocationsImportPage, {
			props: { orgSlug: 'test-org', source: 'google-sheets' }
		});

		await expect
			.element(getByRole('heading', { name: 'Import from Google Sheets' }))
			.toBeVisible();
		await expect.element(getByLabelText('Google Sheets URL')).toBeVisible();
		await expect.element(getByRole('button', { name: /import/i })).toBeVisible();
	});

	test('breadcrumb links back to locations page', async () => {
		const { getByRole } = render(UniverseDataLocationsImportPage, {
			props: { orgSlug: 'my-org', source: 'csv' }
		});

		const link = getByRole('link', { name: 'Locations' });
		await expect.element(link).toHaveAttribute('href', '/o/my-org/s/universe/data/locations');
	});

	test('csv button is disabled when no handler is provided', async () => {
		const { getByRole } = render(UniverseDataLocationsImportPage, {
			props: { orgSlug: 'test-org', source: 'csv' }
		});

		await expect.element(getByRole('button', { name: /choose file/i })).toBeDisabled();
	});
});
