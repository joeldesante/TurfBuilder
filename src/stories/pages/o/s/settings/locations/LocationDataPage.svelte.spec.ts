import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import LocationDataPage from './LocationDataPage.svelte';

const baseProps = { count: 42, org_slug: 'test-org' };

describe('LocationDataPage', () => {
	describe('rendering', () => {
		it('renders the page heading', async () => {
			render(LocationDataPage, baseProps);
			await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Import Locations');
		});

		it('displays the current location count', async () => {
			render(LocationDataPage, baseProps);
			await expect.element(page.getByText(/42/)).toBeVisible();
		});

		it('renders the file input', async () => {
			render(LocationDataPage, baseProps);
			await expect.element(page.getByLabelText('Browse files')).toBeVisible();
		});

		it('renders the download template button', async () => {
			render(LocationDataPage, baseProps);
			await expect.element(page.getByRole('button', { name: /Download CSV template/i })).toBeVisible();
		});

		it('renders the Import Locations button', async () => {
			render(LocationDataPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Import Locations' })).toBeVisible();
		});

		it('disables the Import button when no file is selected', async () => {
			render(LocationDataPage, baseProps);
			await expect.element(page.getByRole('button', { name: 'Import Locations' })).toBeDisabled();
		});

		it('uses singular "location" when count is 1', async () => {
			render(LocationDataPage, { count: 1, org_slug: 'test-org' });
			await expect.element(page.getByText(/1 private location in/)).toBeVisible();
		});

		it('uses plural "locations" when count is 0', async () => {
			render(LocationDataPage, { count: 0, org_slug: 'test-org' });
			await expect.element(page.getByText(/0 private locations in/)).toBeVisible();
		});
	});

	describe('template download', () => {
		it('triggers a download when the template button is clicked', async () => {
			const createObjectURL = vi.fn().mockReturnValue('blob:fake');
			const revokeObjectURL = vi.fn();
			URL.createObjectURL = createObjectURL;
			URL.revokeObjectURL = revokeObjectURL;

			render(LocationDataPage, baseProps);
			await page.getByRole('button', { name: /Download CSV template/i }).click();

			expect(createObjectURL).toHaveBeenCalled();
		});
	});

	describe('upload result', () => {
		beforeEach(() => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ imported: 10, skipped: 2, errors: [{ row: 3, reason: 'Missing latitude' }] })
			}));
		});

		it('shows import count after successful upload', async () => {
			render(LocationDataPage, baseProps);

			const file = new File(['location_name,latitude,longitude\nTest,40.0,-75.0'], 'locs.csv', { type: 'text/csv' });
			const input = page.getByLabelText('Browse files');
			await input.setInputFiles(file);

			await page.getByRole('button', { name: 'Import Locations' }).click();

			await expect.element(page.getByText(/Imported 10 locations/)).toBeVisible();
		});

		it('shows skipped count when rows were skipped', async () => {
			render(LocationDataPage, baseProps);

			const file = new File(['location_name,latitude,longitude\nTest,40.0,-75.0'], 'locs.csv', { type: 'text/csv' });
			await page.getByLabelText('Browse files').setInputFiles(file);
			await page.getByRole('button', { name: 'Import Locations' }).click();

			await expect.element(page.getByText(/2 skipped/)).toBeVisible();
		});

		it('shows error toggle when errors are present', async () => {
			render(LocationDataPage, baseProps);

			const file = new File(['location_name,latitude,longitude\nTest,40.0,-75.0'], 'locs.csv', { type: 'text/csv' });
			await page.getByLabelText('Browse files').setInputFiles(file);
			await page.getByRole('button', { name: 'Import Locations' }).click();

			await expect.element(page.getByText(/Show 1 row error/)).toBeVisible();
		});
	});
});
