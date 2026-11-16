import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import CsvColumnMapper from './CsvColumnMapper.svelte';

const fields = [
	{ id: 'f1', name: 'name', type: 'text' as const, required: true },
	{ id: 'f2', name: 'phone', type: 'text' as const, required: false },
	{ id: 'f3', name: 'staff', type: 'number' as const, required: false }
];
const headers = ['Name', 'Phone #', 'Notes', 'Lat', 'Lng'];
const samples = [
	['Corner Cafe', '555-0100', 'Closed Mondays', '40.01', '-75.21'],
	['Book Nook', '555-0101', '', '40.02', '-75.22']
];
const base = { headers, samples, fields, onchange: () => {} };
/** Name and phone, and the coordinates; the Notes column fills nothing. */
const full = { f1: 0, f2: 1, 'contact.latitude': 3, 'contact.longitude': 4 };

const row = (name: string) => page.getByRole('button', { name: `Column for ${name}` });
const rowOf = (name: string) => row(name).element().closest('li')!;

test('has a row for every contact data field and every schema field, whatever the file holds', async () => {
	// A file with only a name column: nothing for the coordinates or the address to come from.
	render(CsvColumnMapper, {
		props: { ...base, headers: ['Name'], samples: [['Ada']], mapping: {} }
	});

	for (const name of [
		'Latitude',
		'Longitude',
		'Address line 1',
		'Address line 2',
		'City',
		'State or region',
		'Postal code',
		'Country code',
		'name',
		'phone',
		'staff'
	]) {
		await expect.element(row(name)).toBeVisible();
	}
});

test('has the rows even for a file with no columns at all', async () => {
	render(CsvColumnMapper, { props: { ...base, headers: [], samples: [], mapping: {} } });

	await expect.element(row('Latitude')).toBeVisible();
	await expect.element(row('Latitude')).toHaveTextContent('Not mapped');
});

test('puts the coordinates, the address and the schema fields under their own headings', async () => {
	render(CsvColumnMapper, { props: { ...base, schemaName: 'Business', mapping: full } });

	await expect.element(page.getByRole('heading', { name: 'Location' })).toBeVisible();
	await expect.element(page.getByRole('heading', { name: 'Address' })).toBeVisible();
	await expect.element(page.getByRole('heading', { name: 'Business fields' })).toBeVisible();
});

test('calls the schema\'s group "Schema fields" when it is not told the schema\'s name', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });

	await expect.element(page.getByRole('heading', { name: 'Schema fields' })).toBeVisible();
});

test('lists the coordinates first, then the address from the street to the country, then the schema', async () => {
	const { container } = render(CsvColumnMapper, { props: { ...base, mapping: full } });
	await expect.element(row('Latitude')).toBeVisible();

	const order = Array.from(container.querySelectorAll('button[aria-label^="Column for "]')).map(
		(el) => el.getAttribute('aria-label')?.replace('Column for ', '')
	);
	expect(order).toEqual([
		'Latitude',
		'Longitude',
		'Address line 1',
		'Address line 2',
		'City',
		'State or region',
		'Postal code',
		'Country code',
		'name',
		'phone',
		'staff'
	]);
});

test('puts the column dropdown first, then an arrow, then the label of the field it fills', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });
	await expect.element(row('Latitude')).toBeVisible();

	const li = rowOf('Latitude');
	const dropdown = row('Latitude').element();
	// The arrow is the row's own icon, not the caret inside the dropdown.
	const arrow = li.querySelector(':scope > svg[aria-hidden="true"]')!;
	const label = Array.from(li.querySelectorAll('p')).find((p) =>
		p.textContent?.includes('Latitude')
	)!;
	const follows = (a: Node, b: Node) =>
		!!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
	expect(follows(dropdown, arrow)).toBe(true);
	expect(follows(arrow, label)).toBe(true);
	expect(arrow.getAttribute('aria-hidden')).toBe('true');
});

test('marks the coordinates and required schema fields as required, and the rest not', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });

	expect(rowOf('Latitude').textContent).toContain('required');
	expect(rowOf('Longitude').textContent).toContain('required');
	expect(rowOf('name').textContent).toContain('required');
	expect(rowOf('City').textContent).not.toContain('required');
	expect(rowOf('phone').textContent).not.toContain('required');
	expect(rowOf('Latitude').textContent).toContain('Number');
	expect(rowOf('City').textContent).toContain('Text');
});

test('shows the column that fills each row, or says it is not mapped', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });

	await expect.element(row('name')).toHaveTextContent('Name');
	await expect.element(row('Latitude')).toHaveTextContent('Lat');
	await expect.element(row('Longitude')).toHaveTextContent('Lng');
	await expect.element(row('City')).toHaveTextContent('Not mapped');
	await expect.element(row('staff')).toHaveTextContent('Not mapped');
});

test('shows what the chosen column holds, under the dropdown', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });

	expect(rowOf('name').textContent).toContain('Corner Cafe, Book Nook');
	expect(rowOf('Latitude').textContent).toContain('40.01, 40.02');
});

test('shows nothing about values for a row with no column', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });

	expect(rowOf('City').textContent).not.toContain('No values');
});

test('says a column has no values when the rows read hold none for it', async () => {
	render(CsvColumnMapper, {
		props: {
			...base,
			headers: ['Name', 'Empty'],
			samples: [['Ada', '']],
			mapping: { f1: 0, 'contact.city': 1 }
		}
	});

	expect(rowOf('City').textContent).toContain('No values');
});

test('has no line about the columns that are not imported', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });
	await expect.element(row('Latitude')).toBeVisible();

	// The Notes column fills nothing, and that is not announced.
	await expect.element(page.getByText(/not imported/i)).not.toBeInTheDocument();
	expect(document.body.textContent).not.toMatch(/not imported/i);
});

test('gives a row a column, and reports it', async () => {
	const onchange = vi.fn();
	render(CsvColumnMapper, { props: { ...base, onchange, mapping: full } });

	await row('City').click();
	await page.getByRole('option', { name: 'Notes' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, 'contact.city': 2 });
});

test('can map the coordinates for a file whose columns were not matched by name', async () => {
	const onchange = vi.fn();
	render(CsvColumnMapper, {
		props: {
			...base,
			headers: ['Name', 'X', 'Y'],
			samples: [['Ada', '-75', '40']],
			onchange,
			mapping: { f1: 0 }
		}
	});

	await row('Latitude').click();
	await page.getByRole('option', { name: 'Y' }).click();

	expect(onchange).toHaveBeenCalledWith({ f1: 0, 'contact.latitude': 2 });
});

test('points a row at another column without touching the others', async () => {
	const onchange = vi.fn();
	render(CsvColumnMapper, { props: { ...base, onchange, mapping: full } });

	await row('Latitude').click();
	await page.getByRole('option', { name: 'Notes' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, 'contact.latitude': 2 });
});

test('clears a row with Not mapped, and only that row', async () => {
	const onchange = vi.fn();
	render(CsvColumnMapper, { props: { ...base, onchange, mapping: full } });

	await row('phone').click();
	await page.getByRole('option', { name: 'Not mapped' }).click();

	expect(onchange).toHaveBeenCalledWith({ f1: 0, 'contact.latitude': 3, 'contact.longitude': 4 });
});

test('lets a column that already fills one row fill another as well', async () => {
	const onchange = vi.fn();
	render(CsvColumnMapper, { props: { ...base, onchange, mapping: full } });

	// Name is the column for the schema's name, and now the street too.
	await row('Address line 1').click();
	await page.getByRole('option', { name: 'Name' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, 'contact.address_line_1': 0 });
});

test('lists every column for every row, none of them held back', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });

	for (const name of ['City', 'Latitude', 'name']) {
		await row(name).click();
		const options = await page.getByRole('option').all();
		// Not mapped, and each of the five columns.
		expect(options).toHaveLength(6);
		for (const option of options) {
			expect(option.element().getAttribute('aria-disabled')).not.toBe('true');
		}
		await page.getByRole('option', { name: 'Not mapped' }).click();
	}
});

test('shows a message under the row of a field with an error', async () => {
	render(CsvColumnMapper, {
		props: {
			...base,
			mapping: { f1: 0 },
			errors: {
				'mapping.contact.latitude': ['Latitude needs a column'],
				'mapping.contact.longitude': ['Longitude needs a column']
			}
		}
	});

	await expect.element(page.getByText('Latitude needs a column')).toBeVisible();
	await expect.element(page.getByText('Longitude needs a column')).toBeVisible();
	expect(rowOf('Latitude').textContent).toContain('Latitude needs a column');
	expect(rowOf('Longitude').textContent).toContain('Longitude needs a column');
	// Only on the row it is about.
	expect(rowOf('City').textContent).not.toContain('needs a column');
});

test('marks the dropdown of a field with an error as invalid', async () => {
	render(CsvColumnMapper, {
		props: {
			...base,
			mapping: {},
			errors: { 'mapping.contact.latitude': ['Latitude needs a column'] }
		}
	});

	await expect.element(row('Latitude')).toHaveAttribute('aria-invalid', 'true');
	await expect.element(row('Longitude')).not.toHaveAttribute('aria-invalid');
});

test('shows only the first message when a field has several', async () => {
	render(CsvColumnMapper, {
		props: {
			...base,
			mapping: {},
			errors: { 'mapping.contact.latitude': ['First problem', 'Second problem'] }
		}
	});

	await expect.element(page.getByText('First problem')).toBeVisible();
	await expect.element(page.getByText('Second problem')).not.toBeInTheDocument();
});

test('shows no message when there are no errors', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });
	await expect.element(row('Latitude')).toBeVisible();

	await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
});

test('heads each table with CSV and CONTACT, the file on the left and the contact on the right', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });
	await expect.element(row('Latitude')).toBeVisible();

	// Location, Address, and the schema's own fields: a table each.
	const csv = Array.from(document.querySelectorAll('span')).filter(
		(el) => el.textContent === 'CSV'
	);
	const contact = Array.from(document.querySelectorAll('span')).filter(
		(el) => el.textContent === 'CONTACT'
	);
	expect(csv).toHaveLength(3);
	expect(contact).toHaveLength(3);
	csv.forEach((el, i) => {
		expect(!!(el.compareDocumentPosition(contact[i]) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
			true
		);
	});
});

test('puts each heading above the rows it names, inside the same table', async () => {
	render(CsvColumnMapper, { props: { ...base, mapping: full } });
	await expect.element(row('Latitude')).toBeVisible();

	const table = rowOf('Latitude').closest('div.overflow-hidden')!;
	expect(table.textContent?.startsWith('CSV')).toBe(true);
	expect(table.textContent).toContain('CONTACT');
	// The heading comes before the first row.
	const heading = Array.from(table.querySelectorAll('span')).find(
		(el) => el.textContent === 'CSV'
	)!;
	expect(
		!!(heading.compareDocumentPosition(rowOf('Latitude')) & Node.DOCUMENT_POSITION_FOLLOWING)
	).toBe(true);
});

test('has a heading on each table of a schema with no fields too, which has two', async () => {
	render(CsvColumnMapper, {
		props: { ...base, fields: [], mapping: { 'contact.latitude': 3, 'contact.longitude': 4 } }
	});
	await expect.element(row('Latitude')).toBeVisible();

	const csv = Array.from(document.querySelectorAll('span')).filter(
		(el) => el.textContent === 'CSV'
	);
	expect(csv).toHaveLength(2);
});

test('has no schema section for a schema with no fields, but still the coordinates and the address', async () => {
	render(CsvColumnMapper, {
		props: { ...base, fields: [], mapping: { 'contact.latitude': 3, 'contact.longitude': 4 } }
	});

	await expect.element(row('Latitude')).toBeVisible();
	await expect.element(row('City')).toBeVisible();
	await expect
		.element(page.getByRole('heading', { name: 'Schema fields' }))
		.not.toBeInTheDocument();
});
