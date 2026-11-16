import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { page } from '@vitest/browser/context';
// The real stylesheet, so the container breakpoints and sizes are the app's own.
import '/src/app.css';
import CsvColumnMapper from './CsvColumnMapper.svelte';

const fields = [{ id: 'f1', name: 'name', type: 'text' as const, required: true }];
const props = {
	headers: ['Name', 'Lat', 'Lng'],
	samples: [['Ada', '40', '-75']],
	fields,
	onchange: () => {},
	mapping: { f1: 0, 'contact.latitude': 1, 'contact.longitude': 2 }
};

/** The mapper in a box of a given width, as in a wide page or on a phone. */
function renderIn(width: number) {
	const host = document.createElement('div');
	host.style.cssText = `width:${width}px;`;
	document.body.appendChild(host);
	render(CsvColumnMapper, { target: host, props });
}

const parts = () => {
	const li = page.getByRole('button', { name: 'Column for Latitude' }).element().closest('li')!;
	const dropdown = page.getByRole('button', { name: 'Column for Latitude' }).element();
	const label = Array.from(li.querySelectorAll('p')).find((p) =>
		p.textContent?.includes('Latitude')
	)!;
	const arrows = Array.from(li.querySelectorAll('svg')).filter(
		(svg) => svg.getAttribute('aria-hidden') === 'true'
	);
	const visible = (el: Element) => getComputedStyle(el).display !== 'none';
	return { li, dropdown, label, arrows: arrows.filter(visible) };
};
const box = (el: Element) => el.getBoundingClientRect();

test('when it is wide, the column dropdown is on the left, the arrow in the middle, and the field label on the right', async () => {
	renderIn(900);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	const { dropdown, label, arrows } = parts();
	expect(arrows).toHaveLength(1);
	const arrow = box(arrows[0]);
	expect(box(dropdown).right).toBeLessThanOrEqual(arrow.left);
	expect(arrow.right).toBeLessThanOrEqual(box(label).left);
});

test('when it is wide, the three parts share a line', async () => {
	renderIn(900);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	const { dropdown, label, arrows } = parts();
	const middle = (el: Element) => box(el).top + box(el).height / 2;
	expect(Math.abs(middle(dropdown) - middle(label))).toBeLessThan(24);
	expect(Math.abs(middle(arrows[0]) - middle(dropdown))).toBeLessThan(24);
});

test('when it is wide, the arrow points right', async () => {
	renderIn(900);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	const { li } = parts();
	const [right, down] = Array.from(li.querySelectorAll('svg[aria-hidden="true"]'));
	expect(getComputedStyle(right).display).not.toBe('none');
	expect(getComputedStyle(down).display).toBe('none');
});

test('when it is narrow, they stack: the dropdown above the field label, with an arrow pointing down', async () => {
	renderIn(320);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	const { dropdown, label, arrows, li } = parts();
	expect(arrows).toHaveLength(1);
	expect(box(dropdown).bottom).toBeLessThanOrEqual(box(arrows[0]).top + 1);
	expect(box(arrows[0]).bottom).toBeLessThanOrEqual(box(label).top + 1);
	const [right, down] = Array.from(li.querySelectorAll('svg[aria-hidden="true"]'));
	expect(getComputedStyle(right).display).toBe('none');
	expect(getComputedStyle(down).display).not.toBe('none');
});

test('stays inside its box at either width', async () => {
	for (const width of [320, 900]) {
		document.body.innerHTML = '';
		renderIn(width);
		await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

		const { li } = parts();
		expect(li.scrollWidth).toBeLessThanOrEqual(li.clientWidth + 1);
	}
});

test('puts an error across the whole row, under the three parts', async () => {
	const host = document.createElement('div');
	host.style.cssText = 'width:900px;';
	document.body.appendChild(host);
	render(CsvColumnMapper, {
		target: host,
		props: {
			...props,
			mapping: { f1: 0 },
			errors: { 'mapping.contact.latitude': ['Latitude needs a column'] }
		}
	});
	await expect.element(page.getByText('Latitude needs a column')).toBeVisible();

	const { dropdown, label } = parts();
	const error = box(page.getByText('Latitude needs a column').element());
	expect(error.top).toBeGreaterThanOrEqual(Math.max(box(dropdown).bottom, box(label).bottom) - 1);
	expect(error.width).toBeGreaterThan(box(label).width);
});

const heading = (word: string) =>
	Array.from(document.querySelectorAll('span')).find((el) => el.textContent === word)!;

test('when it is wide, CSV sits over the dropdowns and CONTACT over the field labels', async () => {
	renderIn(900);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	const { dropdown, label } = parts();
	expect(Math.abs(box(heading('CSV')).left - box(dropdown).left)).toBeLessThan(2);
	expect(Math.abs(box(heading('CONTACT')).left - box(label).left)).toBeLessThan(2);
	expect(box(heading('CSV')).bottom).toBeLessThanOrEqual(box(dropdown).top);
});

test('when it is narrow, the headings stack in the order the rows do: CSV, then CONTACT', async () => {
	renderIn(320);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	expect(box(heading('CSV')).bottom).toBeLessThanOrEqual(box(heading('CONTACT')).top + 1);
	expect(Math.abs(box(heading('CSV')).left - box(heading('CONTACT')).left)).toBeLessThan(2);
});

test('the headings read as a header: small, muted, and on a tinted band', async () => {
	renderIn(900);
	await expect.element(page.getByRole('button', { name: 'Column for Latitude' })).toBeVisible();

	const band = heading('CSV').parentElement!;
	expect(parseFloat(getComputedStyle(heading('CSV')).fontSize)).toBeLessThan(14);
	expect(getComputedStyle(band).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
});

test('puts a field error on a red band, so it stands apart from the rest of the row', async () => {
	const host = document.createElement('div');
	host.style.cssText = 'width:900px;';
	document.body.appendChild(host);
	render(CsvColumnMapper, {
		target: host,
		props: {
			...props,
			mapping: { f1: 0 },
			errors: { 'mapping.contact.latitude': ['Latitude needs a column'] }
		}
	});
	await expect.element(page.getByText('Latitude needs a column')).toBeVisible();

	const error = page.getByText('Latitude needs a column').element();
	const row = error.closest('li')!;
	const background = getComputedStyle(error).backgroundColor;
	expect(background).not.toBe('rgba(0, 0, 0, 0)');
	// A different colour from the row around it, and from the plain text colour.
	expect(background).not.toBe(getComputedStyle(row).backgroundColor);
	expect(getComputedStyle(error).color).not.toBe(getComputedStyle(row).color);
	// It looks like a band with room around the words, not text bare on the row.
	expect(parseFloat(getComputedStyle(error).paddingLeft)).toBeGreaterThanOrEqual(8);
	expect(parseFloat(getComputedStyle(error).borderTopLeftRadius)).toBeGreaterThan(0);
});

test('has the red only on the rows with an error', async () => {
	const host = document.createElement('div');
	host.style.cssText = 'width:900px;';
	document.body.appendChild(host);
	render(CsvColumnMapper, {
		target: host,
		props: {
			...props,
			mapping: { f1: 0 },
			errors: { 'mapping.contact.latitude': ['Latitude needs a column'] }
		}
	});
	await expect.element(page.getByText('Latitude needs a column')).toBeVisible();

	expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
	const longitude = page
		.getByRole('button', { name: 'Column for Longitude' })
		.element()
		.closest('li')!;
	expect(longitude.querySelector('.bg-error-container')).toBeNull();
});
