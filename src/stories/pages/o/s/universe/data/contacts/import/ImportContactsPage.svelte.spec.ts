import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import Toaster from '$components/feedback/toaster/Toaster.svelte';
import { toast } from 'svelte-sonner';
import { indexCsvChunks } from '$lib/shared/utils/csv-index';
// The real stylesheet, so the Spreadsheet grid scrolls inside the page as it does in the app.
import '/src/app.css';
import ImportContactsPage from './ImportContactsPage.svelte';

/** A CSV of `rows` people, written the way the page reads them. */
const manyRows = (rows: number) =>
	'Name,Phone #\n' + Array.from({ length: rows }, (_, i) => `Name${i},555-${i}`).join('\n') + '\n';

/** Scrolls the Spreadsheet grid so `row` is at the top. */
async function scrollGridTo(row: number) {
	const viewport = document.querySelector<HTMLElement>('[data-testid="grid-viewport"]')!;
	viewport.scrollTop = row * 45;
	viewport.dispatchEvent(new Event('scroll'));
}

describe('ImportContactsPage', () => {
	it('shows the page title', async () => {
		render(ImportContactsPage, { props: { orgSlug: 'acme' } });
		await expect.element(page.getByRole('heading', { name: 'Import Contacts' })).toBeVisible();
	});

	it('has a back link to the contacts page', async () => {
		render(ImportContactsPage, { props: { orgSlug: 'acme' } });
		await expect
			.element(page.getByRole('link', { name: 'Back to Contacts' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts');
	});

	it('has a CSV drop zone with an upload button', async () => {
		render(ImportContactsPage, { props: { orgSlug: 'acme' } });
		await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Upload CSV' })).toBeVisible();
	});

	it('shows no notice when uploads are available', async () => {
		render(ImportContactsPage, { props: { orgSlug: 'acme' } });
		await expect.element(page.getByTestId('import-unavailable')).not.toBeInTheDocument();
	});

	it('replaces the drop zone with a vague notice when uploads are not available', async () => {
		render(ImportContactsPage, { props: { orgSlug: 'acme', available: false } });
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent(
				'This feature is disabled because the software is not yet configured to support it. Please contact your administrator.'
			);
		await expect.element(page.getByText('Drop a CSV file here')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Upload CSV' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Back to Contacts' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Import Contacts' })).toBeVisible();
	});

	describe('mapping the columns', () => {
		const schemas = [
			{
				id: 's1',
				org_id: 'o1',
				schema_name: 'Business',
				fields: [
					{ id: 'f1', name: 'name', type: 'text' as const, required: true },
					{ id: 'f2', name: 'phone', type: 'text' as const, required: false }
				],
				identifier_field_id: 'f1',
				contact_count: 0,
				created_at: '',
				updated_at: ''
			},
			{
				id: 's2',
				org_id: 'o1',
				schema_name: 'Venue',
				fields: [],
				identifier_field_id: null,
				contact_count: 0,
				created_at: '',
				updated_at: ''
			}
		];
		const csv = () =>
			new File(
				['Name,Phone #,Notes,Lat,Lng\nCorner Cafe,555-0100,Closed Mondays,40.01,-75.21\n'],
				'places.csv',
				{ type: 'text/csv' }
			);

		async function upload(props: Record<string, unknown> = {}, uploaded: unknown = undefined) {
			const onUpload = vi.fn().mockResolvedValue(uploaded);
			render(ImportContactsPage, { props: { orgSlug: 'acme', schemas, onUpload, ...props } });
			await userEvent.upload(page.getByTestId('file-dropzone-input'), csv());
			return onUpload;
		}

		it('links to the active imports page', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', schemas } });
			await expect
				.element(page.getByRole('link', { name: 'Active imports' }))
				.toHaveAttribute('href', '/o/acme/s/universe/data/contacts/import/active');
		});

		it('starts on step 1', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', schemas } });
			await expect.element(page.getByText('Step 1 of 2: Upload a file')).toBeVisible();
		});

		it('moves to step 2 once the upload finishes and shows the fields to fill', async () => {
			await upload();
			await expect.element(page.getByRole('button', { name: 'Mapping' })).toBeVisible();
			// The fields are listed once there is a schema to map them to.
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Column for phone' }))
				.toHaveTextContent('Phone #');
		});

		it('stays on step 1 while the upload has not finished', async () => {
			const onUpload = vi.fn().mockReturnValue(new Promise(() => {}));
			render(ImportContactsPage, { props: { orgSlug: 'acme', schemas, onUpload } });
			await userEvent.upload(page.getByTestId('file-dropzone-input'), csv());
			await expect.element(page.getByText('Uploading places.csv')).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Mapping' })).not.toBeInTheDocument();
		});

		it('asks for a schema before it shows the mapping', async () => {
			await upload();
			await expect.element(page.getByRole('button', { name: 'Schema' })).toBeVisible();
			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.not.toBeInTheDocument();
			await expect
				.element(page.getByRole('button', { name: 'Column for Latitude' }))
				.not.toBeInTheDocument();
		});

		it('suggests a column for each field by name once a schema is chosen', async () => {
			await upload();
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();

			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Name');
			await expect
				.element(page.getByRole('button', { name: 'Column for phone' }))
				.toHaveTextContent('Phone #');
			await expect
				.element(page.getByRole('button', { name: 'Column for Latitude' }))
				.toHaveTextContent('Lat');
			await expect
				.element(page.getByRole('button', { name: 'Column for Longitude' }))
				.toHaveTextContent('Lng');
			await expect
				.element(page.getByRole('button', { name: 'Column for City' }))
				.toHaveTextContent('Not mapped');
		});

		it('says nothing about the columns that fill no field', async () => {
			await upload();
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

			expect(document.body.textContent).not.toMatch(/not imported/i);
		});

		it('has no step 2 caption, and puts the tabs where it was, beside Choose a different file', async () => {
			await upload();
			const container = document.body;
			await expect.element(page.getByText(/Step 2 of 2/)).not.toBeInTheDocument();
			const row = container.querySelector('nav[aria-label="Import views"]')!.parentElement!;
			expect(row.textContent).toContain('Choose a different file');
		});

		it('goes back to step 1, not to the contacts page, from the back button on step 2', async () => {
			await upload();
			await expect
				.element(page.getByRole('link', { name: 'Back to Contacts' }))
				.not.toBeInTheDocument();

			await page.getByRole('button', { name: 'Back to upload' }).click();

			await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
			await expect.element(page.getByText('Step 1 of 2: Upload a file')).toBeVisible();
		});

		it('goes back to the contacts page from the back button on step 1', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', schemas } });
			await expect
				.element(page.getByRole('link', { name: 'Back to Contacts' }))
				.toHaveAttribute('href', '/o/acme/s/universe/data/contacts');
			await expect
				.element(page.getByRole('button', { name: 'Back to upload' }))
				.not.toBeInTheDocument();
		});

		it('has Mapping and Spreadsheet tabs on step 2, starting on Mapping', async () => {
			await upload();
			await expect
				.element(page.getByRole('button', { name: 'Mapping' }))
				.toHaveAttribute('aria-current', 'true');
			await expect.element(page.getByRole('button', { name: 'Spreadsheet' })).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Schema' })).toBeVisible();
		});

		it('shows the uploaded rows in a grid on the Spreadsheet tab', async () => {
			await upload();
			await page.getByRole('button', { name: 'Spreadsheet' }).click();

			await expect.element(page.getByRole('grid')).toBeVisible();
			await expect.element(page.getByRole('columnheader', { name: 'Phone #' })).toBeVisible();
			await expect.element(page.getByRole('gridcell', { name: 'Corner Cafe' })).toBeVisible();
			await expect.element(page.getByText('1 rows')).toBeVisible();
		});

		it('reads every row of the uploaded file, not just a sample, once it has a row index', async () => {
			const text = manyRows(300);
			const index = await indexCsvChunks([new TextEncoder().encode(text)], 10);
			const onUpload = vi.fn().mockResolvedValue({ importId: 'imp-1', index });
			render(ImportContactsPage, { props: { orgSlug: 'acme', schemas, onUpload } });
			await userEvent.upload(
				page.getByTestId('file-dropzone-input'),
				new File([text], 'big.csv', { type: 'text/csv' })
			);
			await page.getByRole('button', { name: 'Spreadsheet' }).click();

			await expect.element(page.getByText('300 rows')).toBeVisible();
			await expect
				.element(page.getByRole('gridcell', { name: 'Name0', exact: true }))
				.toBeVisible();

			await scrollGridTo(250);
			await expect
				.element(page.getByRole('gridcell', { name: 'Name250', exact: true }))
				.toBeVisible();
		});

		it('jumps to the row a page button names on the Spreadsheet tab', async () => {
			const text = manyRows(10_000);
			const index = await indexCsvChunks([new TextEncoder().encode(text)]);
			const onUpload = vi.fn().mockResolvedValue({ importId: 'imp-1', index });
			const { container } = render(ImportContactsPage, {
				props: { orgSlug: 'acme', schemas, onUpload }
			});
			// The staff layout gives the page the height of the screen, and a desktop is wide enough for five page buttons.
			container.style.height = '800px';
			container.style.width = '900px';
			await userEvent.upload(
				page.getByTestId('file-dropzone-input'),
				new File([text], 'big.csv', { type: 'text/csv' })
			);
			await page.getByRole('button', { name: 'Spreadsheet' }).click();
			await expect.element(page.getByText('10,000 rows')).toBeVisible();

			await page.getByRole('button', { name: 'Jump to 4,000' }).click();

			// Row id 4000 is the 4000th data row, Name3999, and it is first under the header.
			await expect
				.element(page.getByRole('gridcell', { name: 'Name3999', exact: true }))
				.toBeVisible();
			const viewport = document.querySelector<HTMLElement>('[data-testid="grid-viewport"]')!;
			const top = viewport.getBoundingClientRect().top + 44;
			const first = Array.from(
				document.querySelectorAll<HTMLElement>('[role="row"][aria-rowindex]')
			)
				.filter((row) => row.getBoundingClientRect().top >= top)
				.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
			expect(first.textContent).toContain('Name3999');
		});

		it('shows only the sample rows when the upload gave no row index', async () => {
			await upload();
			await page.getByRole('button', { name: 'Spreadsheet' }).click();

			await expect.element(page.getByText('1 rows')).toBeVisible();
		});

		it('leaves the schema and Begin Import off the Spreadsheet tab', async () => {
			await upload();
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await page.getByRole('button', { name: 'Spreadsheet' }).click();

			await expect
				.element(page.getByRole('button', { name: 'Spreadsheet' }))
				.toHaveAttribute('aria-current', 'true');
			await expect.element(page.getByRole('button', { name: 'Schema' })).not.toBeInTheDocument();
			await expect
				.element(page.getByRole('button', { name: 'Begin Import' }))
				.not.toBeInTheDocument();
		});

		it('keeps the mapping when switching to Spreadsheet and back', async () => {
			await upload();
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await page.getByRole('button', { name: 'Spreadsheet' }).click();
			await page.getByRole('button', { name: 'Mapping' }).click();

			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Name');
			await expect
				.element(page.getByRole('button', { name: 'Column for Latitude' }))
				.toHaveTextContent('Lat');
		});

		it('has no Begin Import button until a schema is chosen', async () => {
			await upload();
			await expect
				.element(page.getByRole('button', { name: 'Begin Import' }))
				.not.toBeInTheDocument();
		});

		it('shows Begin Import under the fields and reports which column fills each when pressed', async () => {
			const onBeginImport = vi.fn();
			await upload({ onBeginImport }, { importId: 'imp1' });
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();

			await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeEnabled();
			await page.getByRole('button', { name: 'Begin Import' }).click();

			await vi.waitFor(() =>
				expect(onBeginImport).toHaveBeenCalledWith({
					importId: 'imp1',
					schemaId: 's1',
					mapping: { f1: 0, f2: 1, 'contact.latitude': 3, 'contact.longitude': 4 }
				})
			);
		});

		it('does nothing on Begin Import when the upload reported no id', async () => {
			const onBeginImport = vi.fn();
			await upload({ onBeginImport });
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await page.getByRole('button', { name: 'Begin Import' }).click();

			await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeEnabled();
			expect(onBeginImport).not.toHaveBeenCalled();
		});

		it('keeps Begin Import busy until the import has been started', async () => {
			let finish: () => void = () => {};
			const onBeginImport = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
			await upload({ onBeginImport }, { importId: 'imp1' });
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await page.getByRole('button', { name: 'Begin Import' }).click();

			await vi.waitFor(() => expect(onBeginImport).toHaveBeenCalled());
			await expect
				.element(page.getByRole('button', { name: 'Begin Import' }))
				.toHaveAttribute('aria-busy', 'true');
			finish();
			await expect
				.element(page.getByRole('button', { name: 'Begin Import' }))
				.not.toHaveAttribute('aria-busy', 'true');
		});

		describe('mapping contact data', () => {
			/** A file with an address and coordinates, and one with neither. */
			const addressCsv = () =>
				new File(
					['Name,Street,City,Zip,Lat,Lng\nCorner Cafe,1 Main St,Austin,78701,30.27,-97.74\n'],
					'places.csv',
					{ type: 'text/csv' }
				);
			const bareCsv = () =>
				new File(['Name,Phone #\nCorner Cafe,555-0100\n'], 'bare.csv', { type: 'text/csv' });

			async function openWith(file: File, onBeginImport = vi.fn()) {
				const onUpload = vi.fn().mockResolvedValue(undefined);
				render(ImportContactsPage, {
					props: { orgSlug: 'acme', schemas: [schemas[0]], onUpload, onBeginImport }
				});
				await userEvent.upload(page.getByTestId('file-dropzone-input'), file);
				return onBeginImport;
			}

			it('suggests the address and the coordinates from the column names', async () => {
				await openWith(addressCsv());

				await expect
					.element(page.getByRole('button', { name: 'Column for name' }))
					.toHaveTextContent('Name');
				await expect
					.element(page.getByRole('button', { name: 'Column for Address line 1' }))
					.toHaveTextContent('Street');
				await expect
					.element(page.getByRole('button', { name: 'Column for City' }))
					.toHaveTextContent('City');
				await expect
					.element(page.getByRole('button', { name: 'Column for Postal code' }))
					.toHaveTextContent('Zip');
				await expect
					.element(page.getByRole('button', { name: 'Column for Latitude' }))
					.toHaveTextContent('Lat');
				await expect
					.element(page.getByRole('button', { name: 'Column for Longitude' }))
					.toHaveTextContent('Lng');
			});

			it('shows the coordinates and the address even when the file has no such columns', async () => {
				await openWith(bareCsv());

				for (const field of [
					'Latitude',
					'Longitude',
					'Address line 1',
					'Address line 2',
					'City',
					'State or region',
					'Postal code',
					'Country code'
				]) {
					const dropdown = page.getByRole('button', { name: `Column for ${field}` });
					await expect.element(dropdown).toBeVisible();
					await expect.element(dropdown).toHaveTextContent('Not mapped');
				}
			});

			it('lets Begin Import go once the coordinates are mapped, and reports which column fills each field', async () => {
				const onBeginImport = await openWith(addressCsv());

				await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeEnabled();
				await page.getByRole('button', { name: 'Begin Import' }).click();

				await vi.waitFor(() =>
					expect(onBeginImport).toHaveBeenCalledWith({
						schemaId: 's1',
						mapping: {
							f1: 0,
							'contact.address_line_1': 1,
							'contact.city': 2,
							'contact.postal_code': 3,
							'contact.latitude': 4,
							'contact.longitude': 5
						}
					})
				);
			});

			it('keeps Begin Import off, and says on each coordinate row that it needs a column, when the file has none', async () => {
				await openWith(bareCsv());

				await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeDisabled();
				await expect.element(page.getByText('Latitude needs a column')).toBeVisible();
				await expect.element(page.getByText('Longitude needs a column')).toBeVisible();
				// Right on the row it is about, not in one block of text.
				expect(
					page.getByRole('button', { name: 'Column for Latitude' }).element().closest('li')!
						.textContent
				).toContain('Latitude needs a column');
				expect(
					page.getByRole('button', { name: 'Column for Longitude' }).element().closest('li')!
						.textContent
				).toContain('Longitude needs a column');
			});

			it('opens Begin Import only once both coordinates have a column', async () => {
				await openWith(bareCsv());

				await page.getByRole('button', { name: 'Column for Latitude' }).click();
				await page.getByRole('option', { name: 'Phone #' }).click();
				await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeDisabled();
				await expect.element(page.getByText('Latitude needs a column')).not.toBeInTheDocument();
				await expect.element(page.getByText('Longitude needs a column')).toBeVisible();

				// The Name column already fills the schema's name, and can fill the longitude as well.
				await page.getByRole('button', { name: 'Column for Longitude' }).click();
				await page.getByRole('option', { name: 'Name' }).click();
				await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeEnabled();
				await expect.element(page.getByText('needs a column')).not.toBeInTheDocument();
			});

			it('lets one column fill two fields, and reports both', async () => {
				const onBeginImport = await openWith(addressCsv());

				// Street is already the first line; it can be the second line too.
				await page.getByRole('button', { name: 'Column for Address line 2' }).click();
				await page.getByRole('option', { name: 'Street' }).click();
				await expect
					.element(page.getByRole('button', { name: 'Column for Address line 1' }))
					.toHaveTextContent('Street');
				await expect
					.element(page.getByRole('button', { name: 'Column for Address line 2' }))
					.toHaveTextContent('Street');
				await page.getByRole('button', { name: 'Begin Import' }).click();

				await vi.waitFor(() =>
					expect(onBeginImport).toHaveBeenCalledWith({
						schemaId: 's1',
						mapping: expect.objectContaining({
							'contact.address_line_1': 1,
							'contact.address_line_2': 1
						})
					})
				);
			});

			it('takes the error off a row once a column is chosen for it', async () => {
				await openWith(bareCsv());
				await expect.element(page.getByText('Latitude needs a column')).toBeVisible();

				await page.getByRole('button', { name: 'Column for Latitude' }).click();
				await page.getByRole('option', { name: 'Phone #' }).click();

				await expect.element(page.getByText('Latitude needs a column')).not.toBeInTheDocument();
			});

			it('does not need the address, which is optional', async () => {
				await openWith(
					new File(['Name,Lat,Lng\nCorner Cafe,30.27,-97.74\n'], 'min.csv', { type: 'text/csv' })
				);

				await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeEnabled();
			});

			it('can send a column to the address by hand', async () => {
				const onBeginImport = await openWith(
					new File(['Name,Where,Lat,Lng\nCorner Cafe,1 Main St,30.27,-97.74\n'], 'by-hand.csv', {
						type: 'text/csv'
					})
				);

				await page.getByRole('button', { name: 'Column for Address line 1' }).click();
				await page.getByRole('option', { name: 'Where' }).click();
				await page.getByRole('button', { name: 'Begin Import' }).click();

				await vi.waitFor(() =>
					expect(onBeginImport).toHaveBeenCalledWith({
						schemaId: 's1',
						mapping: {
							f1: 0,
							'contact.address_line_1': 1,
							'contact.latitude': 2,
							'contact.longitude': 3
						}
					})
				);
			});
		});

		it('keeps Begin Import off while a required field has no column', async () => {
			await upload();
			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Business' }).click();
			await page.getByRole('button', { name: 'Column for name' }).click();
			await page.getByRole('option', { name: 'Not mapped' }).click();

			await expect.element(page.getByRole('button', { name: 'Begin Import' })).toBeDisabled();
			await expect.element(page.getByText('name needs a column')).toBeVisible();
		});

		it('chooses the schema itself when there is only one', async () => {
			await upload({ schemas: [schemas[0]] });
			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Name');
		});

		it('goes back to the drop zone from "Choose a different file"', async () => {
			await upload();
			await page.getByRole('button', { name: 'Choose a different file' }).click();
			await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
		});

		it('points to contact schemas when there are none', async () => {
			await upload({ schemas: [] });
			await expect.element(page.getByText(/There are no contact schemas yet/)).toBeVisible();
			await expect
				.element(page.getByRole('link', { name: 'Contact schemas' }))
				.toHaveAttribute('href', '/o/acme/s/universe/data/contact-schemas');
		});
	});

	describe('the uploaded files', () => {
		const day = 86_400_000;
		const files = [
			{
				id: 'i1',
				file_name: 'people.csv',
				size_bytes: 3_670_016,
				row_count: 250_000,
				uploaded_at: new Date(Date.now() - 2 * day).toISOString(),
				expires_at: new Date(Date.now() + 28 * day).toISOString(),
				preserved: false
			},
			{
				id: 'i2',
				file_name: 'donors.csv',
				size_bytes: 2_000,
				row_count: null,
				uploaded_at: new Date(Date.now() - 40 * day).toISOString(),
				expires_at: new Date(Date.now() - 10 * day).toISOString(),
				preserved: false
			},
			{
				id: 'i3',
				file_name: 'archive.csv',
				size_bytes: 10_485_760,
				row_count: 12,
				uploaded_at: new Date(Date.now() - 90 * day).toISOString(),
				expires_at: new Date(Date.now() - 60 * day).toISOString(),
				preserved: true
			}
		];

		it('lists the files with their name, rows, size, upload date and expiry', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files } });

			await expect.element(page.getByRole('heading', { name: 'Uploaded files' })).toBeVisible();
			for (const name of ['File', 'Rows', 'Size', 'Uploaded', 'Expires']) {
				await expect.element(page.getByRole('columnheader', { name })).toBeVisible();
			}
			await expect.element(page.getByRole('cell', { name: 'people.csv' })).toBeVisible();
			await expect.element(page.getByRole('cell', { name: '250,000' })).toBeVisible();
			await expect.element(page.getByRole('cell', { name: '3.5 MB' })).toBeVisible();
		});

		it('shows a dash for a file whose rows were not counted', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files } });
			await expect.element(page.getByRole('cell', { name: '—' })).toBeVisible();
		});

		it('says Expired once the purge date has passed, and Kept for a preserved file', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files } });
			await expect.element(page.getByRole('cell', { name: 'Expired' })).toBeVisible();
			await expect.element(page.getByText('Kept', { exact: true })).toBeVisible();
		});

		describe('archiving a file', () => {
			afterEach(() => {
				toast.dismiss();
			});

			it('has no Archive buttons without a way to archive', async () => {
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files } });
				await expect
					.element(page.getByRole('button', { name: 'Archive people.csv' }))
					.not.toBeInTheDocument();
			});

			it('has an icon-only Archive button on each file, named for the file', async () => {
				render(ImportContactsPage, {
					props: { orgSlug: 'acme', imports: files, onArchiveImport: vi.fn() }
				});

				for (const file of files) {
					const button = page.getByRole('button', { name: `Archive ${file.file_name}` });
					await expect.element(button).toBeVisible();
					// No words on the button, just the icon.
					expect(button.element().textContent?.trim()).toBe('');
					expect(button.element().querySelector('svg')).not.toBeNull();
				}
			});

			it('says Archive in a tooltip when the pointer rests on it', async () => {
				render(ImportContactsPage, {
					props: { orgSlug: 'acme', imports: files, onArchiveImport: vi.fn() }
				});

				await page.getByRole('button', { name: 'Archive people.csv' }).hover();

				await expect.element(page.getByText('Archive', { exact: true })).toBeVisible();
			});

			it('is not nested inside another button, so the tooltip and the click both work', async () => {
				const { container } = render(ImportContactsPage, {
					props: { orgSlug: 'acme', imports: files, onArchiveImport: vi.fn() }
				});
				await expect
					.element(page.getByRole('button', { name: 'Archive people.csv' }))
					.toBeVisible();

				expect(container.querySelector('button button')).toBeNull();
			});

			it('sits beside Load on a row that has both', async () => {
				render(ImportContactsPage, {
					props: {
						orgSlug: 'acme',
						imports: files,
						onLoadImport: vi.fn(),
						onArchiveImport: vi.fn()
					}
				});

				await expect.element(page.getByRole('button', { name: 'Load people.csv' })).toBeVisible();
				await expect
					.element(page.getByRole('button', { name: 'Archive people.csv' }))
					.toBeVisible();
			});

			it('archives the file and says so', async () => {
				const onArchiveImport = vi.fn().mockResolvedValue(undefined);
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onArchiveImport } });
				render(Toaster);

				await page.getByRole('button', { name: 'Archive people.csv' }).click();

				expect(onArchiveImport).toHaveBeenCalledWith(files[0]);
				await expect.element(page.getByText('File archived.')).toBeVisible();
			});

			it('takes the row off the list at once, before the server has answered', async () => {
				const onArchiveImport = vi.fn().mockReturnValue(new Promise(() => {}));
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onArchiveImport } });

				await page.getByRole('button', { name: 'Archive people.csv' }).click();

				await expect
					.element(page.getByRole('cell', { name: 'people.csv', exact: true }))
					.not.toBeInTheDocument();
				// The other files are still there.
				await expect
					.element(page.getByRole('cell', { name: 'archive.csv', exact: true }))
					.toBeVisible();
			});

			it('shows no spinner on the button, however long the server takes', async () => {
				const onArchiveImport = vi.fn().mockReturnValue(new Promise(() => {}));
				const { container } = render(ImportContactsPage, {
					props: { orgSlug: 'acme', imports: files, onArchiveImport }
				});

				await page.getByRole('button', { name: 'Archive people.csv' }).click();

				expect(container.querySelector('.animate-spin')).toBeNull();
				expect(container.querySelector('[aria-busy="true"]')).toBeNull();
			});

			it('keeps the other Archive buttons usable while one file is being archived', async () => {
				const onArchiveImport = vi.fn().mockReturnValue(new Promise(() => {}));
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onArchiveImport } });

				await page.getByRole('button', { name: 'Archive people.csv' }).click();

				await expect
					.element(page.getByRole('button', { name: 'Archive archive.csv' }))
					.toBeEnabled();
			});

			it('does not archive the same file twice', async () => {
				const onArchiveImport = vi.fn().mockReturnValue(new Promise(() => {}));
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onArchiveImport } });

				await page.getByRole('button', { name: 'Archive people.csv' }).click();
				await expect
					.element(page.getByRole('cell', { name: 'people.csv', exact: true }))
					.not.toBeInTheDocument();

				expect(onArchiveImport).toHaveBeenCalledTimes(1);
			});

			it('puts the row back, with a fixed message and not the error, when it cannot be archived', async () => {
				const onArchiveImport = vi.fn().mockRejectedValue(new Error('internal detail'));
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onArchiveImport } });
				render(Toaster);

				await page.getByRole('button', { name: 'Archive people.csv' }).click();

				await expect.element(page.getByText('The file could not be archived.')).toBeVisible();
				await expect.element(page.getByText('internal detail')).not.toBeInTheDocument();
				await expect
					.element(page.getByRole('cell', { name: 'people.csv', exact: true }))
					.toBeVisible();
				await expect
					.element(page.getByRole('button', { name: 'Archive people.csv' }))
					.toBeEnabled();
			});

			it('says there are no files once the last one is archived', async () => {
				const onArchiveImport = vi.fn().mockReturnValue(new Promise(() => {}));
				render(ImportContactsPage, {
					props: { orgSlug: 'acme', imports: [files[0]], onArchiveImport }
				});

				await page.getByRole('button', { name: 'Archive people.csv' }).click();

				await expect.element(page.getByText('No files uploaded yet.')).toBeVisible();
			});
		});

		describe('loading a file', () => {
			const oneSchema = {
				id: 's1',
				org_id: 'o1',
				schema_name: 'Business',
				fields: [{ id: 'f1', name: 'name', type: 'text' as const, required: true }],
				identifier_field_id: 'f1',
				contact_count: 0,
				created_at: '',
				updated_at: ''
			};

			const csvUrl = () =>
				URL.createObjectURL(
					new Blob(['Name,Phone #\nAda,555-0100\nGrace,555-0101\n'], { type: 'text/csv' })
				);

			afterEach(() => {
				toast.dismiss();
			});

			it('has no Load buttons without a way to load', async () => {
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files } });
				await expect
					.element(page.getByRole('button', { name: 'Load people.csv' }))
					.not.toBeInTheDocument();
			});

			it('has a Load button on each file', async () => {
				const onLoadImport = vi.fn();
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onLoadImport } });
				await expect.element(page.getByRole('button', { name: 'Load people.csv' })).toBeEnabled();
				await expect.element(page.getByRole('button', { name: 'Load archive.csv' })).toBeEnabled();
			});

			it('disables Load for a file past its expiry that was not kept', async () => {
				const onLoadImport = vi.fn();
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onLoadImport } });
				await expect.element(page.getByRole('button', { name: 'Load donors.csv' })).toBeDisabled();
			});

			it('reads the chosen file back and moves on to mapping its columns', async () => {
				const onLoadImport = vi.fn().mockResolvedValue({ url: csvUrl(), rowIndex: null });
				render(ImportContactsPage, {
					props: { orgSlug: 'acme', schemas: [oneSchema], imports: files, onLoadImport }
				});

				await page.getByRole('button', { name: 'Load people.csv' }).click();

				expect(onLoadImport).toHaveBeenCalledWith(files[0]);
				await expect.element(page.getByRole('button', { name: 'Mapping' })).toBeVisible();
				// The file's Name column fills the schema's name, and its values show beneath it.
				await expect
					.element(page.getByRole('button', { name: 'Column for name' }))
					.toHaveTextContent('Name');
				await expect.element(page.getByText('Ada, Grace')).toBeVisible();
			});

			it('reads any rows of a loaded file from storage, using its row index', async () => {
				const text = manyRows(300);
				const index = await indexCsvChunks([new TextEncoder().encode(text)], 10);
				const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
				const file = { ...files[0], row_count: 300, size_bytes: text.length };
				const onLoadImport = vi.fn().mockResolvedValue({
					url,
					rowIndex: { interval: index.interval, offsets: index.offsets }
				});
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: [file], onLoadImport } });

				await page.getByRole('button', { name: 'Load people.csv' }).click();
				await page.getByRole('button', { name: 'Spreadsheet' }).click();

				await expect.element(page.getByText('300 rows')).toBeVisible();
				await scrollGridTo(250);
				await expect
					.element(page.getByRole('gridcell', { name: 'Name250', exact: true }))
					.toBeVisible();
			});

			it('shows only the sample rows of a loaded file that has no row index', async () => {
				const onLoadImport = vi.fn().mockResolvedValue({ url: csvUrl(), rowIndex: null });
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onLoadImport } });

				await page.getByRole('button', { name: 'Load people.csv' }).click();
				await page.getByRole('button', { name: 'Spreadsheet' }).click();

				await expect.element(page.getByText('2 rows')).toBeVisible();
			});

			it('says so and stays on step 1 when the file cannot be loaded', async () => {
				const onLoadImport = vi.fn().mockRejectedValue(new Error('internal detail'));
				render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onLoadImport } });
				render(Toaster);

				await page.getByRole('button', { name: 'Load people.csv' }).click();

				await expect.element(page.getByText('The file could not be loaded.')).toBeVisible();
				await expect.element(page.getByText('internal detail')).not.toBeInTheDocument();
				await expect.element(page.getByText('Step 1 of 2: Upload a file')).toBeVisible();
			});
		});

		it('says so when nothing has been uploaded', async () => {
			render(ImportContactsPage, { props: { orgSlug: 'acme', imports: [] } });
			await expect.element(page.getByText('No files uploaded yet.')).toBeVisible();
		});

		it('is not shown on step 2', async () => {
			const onUpload = vi.fn().mockResolvedValue(undefined);
			render(ImportContactsPage, { props: { orgSlug: 'acme', imports: files, onUpload } });
			await userEvent.upload(
				page.getByTestId('file-dropzone-input'),
				new File(['Name\nAda\n'], 'places.csv', { type: 'text/csv' })
			);
			await expect.element(page.getByRole('button', { name: 'Mapping' })).toBeVisible();
			await expect
				.element(page.getByRole('heading', { name: 'Uploaded files' }))
				.not.toBeInTheDocument();
		});
	});

	describe('keeping the place in the address', () => {
		const schema = {
			id: '11111111-1111-4111-8111-111111111111',
			org_id: 'o1',
			schema_name: 'Business',
			fields: [
				{
					id: '22222222-2222-4222-8222-222222222222',
					name: 'name',
					type: 'text' as const,
					required: true
				},
				{
					id: '33333333-3333-4333-8333-333333333333',
					name: 'phone',
					type: 'text' as const,
					required: false
				}
			],
			identifier_field_id: '22222222-2222-4222-8222-222222222222',
			contact_count: 0,
			created_at: '',
			updated_at: ''
		};
		const NAME = schema.fields[0].id;
		const PHONE = schema.fields[1].id;
		const file = {
			id: '3f1c2b9e-0000-4000-8000-000000000001',
			file_name: 'people.csv',
			size_bytes: 40,
			row_count: 2,
			uploaded_at: new Date().toISOString(),
			expires_at: new Date(Date.now() + 86_400_000 * 20).toISOString(),
			preserved: false
		};
		const csvUrl = () =>
			URL.createObjectURL(
				new Blob(['Name,Phone #\nAda,555-0100\nGrace,555-0101\n'], { type: 'text/csv' })
			);
		const loaded = () => vi.fn().mockResolvedValue({ url: csvUrl(), rowIndex: null });
		const baseProps = () => ({
			orgSlug: 'acme',
			schemas: [
				schema,
				{ ...schema, id: '44444444-4444-4444-8444-444444444444', schema_name: 'Venue' }
			],
			imports: [file]
		});

		afterEach(() => {
			toast.dismiss();
		});

		it('picks up on step 2 with the file loaded, as the address says', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: { fileId: file.id, tab: 'mapping', schemaId: schema.id, mapping: null }
				}
			});

			await expect.element(page.getByRole('button', { name: 'Mapping' })).toBeVisible();
			await expect.element(page.getByText('Phone #')).toBeVisible();
			await expect.element(page.getByText('Drop a CSV file here')).not.toBeInTheDocument();
		});

		it('shows that it is loading, not the first step, while it picks up', async () => {
			const onLoadImport = vi.fn().mockReturnValue(new Promise(() => {}));
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport,
					restore: { fileId: file.id, tab: 'mapping', schemaId: '', mapping: null }
				}
			});

			await expect.element(page.getByText('Loading your file...')).toBeVisible();
			await expect.element(page.getByText('Drop a CSV file here')).not.toBeInTheDocument();
		});

		it('opens on the Spreadsheet tab when that was the tab', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: { fileId: file.id, tab: 'spreadsheet', schemaId: '', mapping: null }
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Spreadsheet' }))
				.toHaveAttribute('aria-current', 'true');
			await expect.element(page.getByRole('grid')).toBeVisible();
		});

		it('puts back the chosen schema and the columns as they were mapped', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					// Swapped from what the names suggest, so only a restore explains it.
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [PHONE]: 0, [NAME]: 1 }
					}
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Column for phone' }))
				.toHaveTextContent('Name');
			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Phone #');
		});

		it('puts back a column mapped to contact data, which is not one of the schema fields', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [NAME]: 0, 'contact.latitude': 1 }
					}
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Column for Latitude' }))
				.toHaveTextContent('Phone #');
			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Name');
		});

		it('puts back one column that fills several fields', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [NAME]: 0, 'contact.city': 0, 'contact.address_line_1': 0 }
					}
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Name');
			await expect
				.element(page.getByRole('button', { name: 'Column for City' }))
				.toHaveTextContent('Name');
			await expect
				.element(page.getByRole('button', { name: 'Column for Address line 1' }))
				.toHaveTextContent('Name');
		});

		it('suggests the mapping again when a kept contact data field does not exist', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [NAME]: 0, 'contact.nope': 1 }
					}
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Column for phone' }))
				.toHaveTextContent('Phone #');
		});

		it('reports a contact data mapping in the address state', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					onStateChange,
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [NAME]: 0, 'contact.latitude': 1 }
					}
				}
			});

			await vi.waitFor(() =>
				expect(onStateChange).toHaveBeenLastCalledWith(
					expect.objectContaining({ mapping: { [NAME]: 0, 'contact.latitude': 1 } })
				)
			);
		});

		it('suggests the mapping again when the kept one names a column the file does not have', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [NAME]: 7 }
					}
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Column for name' }))
				.toHaveTextContent('Name');
			await expect
				.element(page.getByRole('button', { name: 'Column for phone' }))
				.toHaveTextContent('Phone #');
		});

		it('ignores a schema that no longer exists', async () => {
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: '99999999-9999-4999-8999-999999999999',
						mapping: { [PHONE]: 0, [NAME]: 1 }
					}
				}
			});

			await expect
				.element(page.getByRole('button', { name: 'Schema' }))
				.toHaveTextContent('Choose schema');
		});

		it('starts on the first step when the file in the address is not in the list', async () => {
			const onLoadImport = loaded();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					imports: [],
					onLoadImport,
					restore: { fileId: file.id, tab: 'mapping', schemaId: '', mapping: null }
				}
			});

			await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
			expect(onLoadImport).not.toHaveBeenCalled();
		});

		it('goes back to the first step, says so, and clears the address when the file will not load', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: vi.fn().mockRejectedValue(new Error('gone')),
					onStateChange,
					restore: { fileId: file.id, tab: 'mapping', schemaId: '', mapping: null }
				}
			});
			render(Toaster);

			await expect.element(page.getByText('The file could not be loaded.')).toBeVisible();
			await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
			await vi.waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith(null));
		});

		it('does not clear the address while it is still picking up where the person was', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: vi.fn().mockReturnValue(new Promise(() => {})),
					onStateChange,
					restore: { fileId: file.id, tab: 'spreadsheet', schemaId: '', mapping: null }
				}
			});
			await expect.element(page.getByText('Loading your file...')).toBeVisible();

			expect(onStateChange).not.toHaveBeenCalled();
		});

		it('reports the file, tab, schema and mapping once it has picked up', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					onStateChange,
					restore: {
						fileId: file.id,
						tab: 'mapping',
						schemaId: schema.id,
						mapping: { [PHONE]: 0, [NAME]: 1 }
					}
				}
			});

			await vi.waitFor(() =>
				expect(onStateChange).toHaveBeenLastCalledWith({
					fileId: file.id,
					tab: 'mapping',
					schemaId: schema.id,
					mapping: { [PHONE]: 0, [NAME]: 1 }
				})
			);
		});

		it('reports a change of tab, and a change of schema', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					onStateChange,
					restore: { fileId: file.id, tab: 'mapping', schemaId: '', mapping: null }
				}
			});
			await expect.element(page.getByRole('button', { name: 'Schema' })).toBeVisible();

			await page.getByRole('button', { name: 'Schema' }).click();
			await page.getByRole('option', { name: 'Venue' }).click();
			await vi.waitFor(() =>
				expect(onStateChange).toHaveBeenLastCalledWith(
					expect.objectContaining({ schemaId: '44444444-4444-4444-8444-444444444444' })
				)
			);

			await page.getByRole('button', { name: 'Spreadsheet' }).click();
			await vi.waitFor(() =>
				expect(onStateChange).toHaveBeenLastCalledWith(
					expect.objectContaining({ tab: 'spreadsheet' })
				)
			);
		});

		it('reports a file just uploaded, by its import id', async () => {
			const onStateChange = vi.fn();
			const onUpload = vi.fn().mockResolvedValue({ importId: file.id, index: undefined });
			render(ImportContactsPage, { props: { ...baseProps(), onUpload, onStateChange } });
			await userEvent.upload(
				page.getByTestId('file-dropzone-input'),
				new File(['Name,Phone #\nAda,555\n'], 'places.csv', { type: 'text/csv' })
			);

			await vi.waitFor(() =>
				expect(onStateChange).toHaveBeenLastCalledWith(
					expect.objectContaining({ fileId: file.id, tab: 'mapping' })
				)
			);
		});

		it('clears the address when the person goes back to the first step', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, {
				props: {
					...baseProps(),
					onLoadImport: loaded(),
					onStateChange,
					restore: { fileId: file.id, tab: 'mapping', schemaId: '', mapping: null }
				}
			});
			await expect.element(page.getByRole('button', { name: 'Back to upload' })).toBeVisible();

			await page.getByRole('button', { name: 'Back to upload' }).click();

			await vi.waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith(null));
			await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
		});

		it('keeps nothing in the address on the first step', async () => {
			const onStateChange = vi.fn();
			render(ImportContactsPage, { props: { ...baseProps(), onStateChange } });

			await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith(null));
		});
	});
});
