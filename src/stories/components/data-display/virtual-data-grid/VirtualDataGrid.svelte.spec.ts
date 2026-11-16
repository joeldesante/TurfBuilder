import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import { page } from '@vitest/browser/context';
// The real stylesheet, so layout, overflow and positioning behave as they do in the app.
import '/src/app.css';
import VirtualDataGrid from './VirtualDataGrid.svelte';

const columns = ['Name', 'Phone'];

function makeRows(offset: number, limit: number, total: number): string[][] {
	return Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => [
		`Person ${offset + i + 1}`,
		`555-${offset + i + 1}`
	]);
}

function source(total: number) {
	return vi.fn(async (offset: number, limit: number) => makeRows(offset, limit, total));
}

function viewport() {
	return document.querySelector<HTMLElement>('[data-testid="grid-viewport"]')!;
}

/** The farthest the rows can be scrolled. */
const maxScroll = () => viewport().scrollHeight - viewport().clientHeight;

/** The 0-based position in the file of the first row under the header. */
function firstRowInView(): number {
	const frame = viewport().getBoundingClientRect();
	const rows = Array.from(document.querySelectorAll<HTMLElement>('[role="row"][aria-rowindex]'))
		.filter((row) => row.getBoundingClientRect().top >= frame.top + 44)
		.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
	return Number(rows[0].getAttribute('aria-rowindex')) - 2;
}

async function scrollTo(top: number) {
	viewport().scrollTop = top;
	viewport().dispatchEvent(new Event('scroll'));
}

test('shows the column headers and the first rows', async () => {
	render(VirtualDataGrid, { props: { columns, totalRows: 1000, loadRows: source(1000) } });

	await expect.element(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
	await expect.element(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
});

test('says how many rows the file has', async () => {
	render(VirtualDataGrid, { props: { columns, totalRows: 300_000, loadRows: source(300_000) } });

	await expect.element(page.getByText('300,000 rows')).toBeVisible();
	await expect.element(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '300001');
});

test('draws only the rows near the viewport, however many the file has', async () => {
	render(VirtualDataGrid, { props: { columns, totalRows: 300_000, loadRows: source(300_000) } });

	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	// The header row plus a screenful and the overscan, nowhere near 300,000.
	expect(document.querySelectorAll('[role="row"]').length).toBeLessThan(100);
});

test('asks for the first page when it appears', async () => {
	const loadRows = source(1000);
	render(VirtualDataGrid, { props: { columns, totalRows: 1000, loadRows, pageSize: 50 } });

	await expect.poll(() => loadRows.mock.calls[0]).toEqual([0, 50]);
});

test('loads the page it is scrolled to, and not the pages in between', async () => {
	const loadRows = source(300_000);
	render(VirtualDataGrid, {
		props: { columns, totalRows: 300_000, loadRows, pageSize: 100, height: '20rem' }
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Halfway down the scroll bar is halfway down the file, however tall the file is.
	await scrollTo(Math.round(maxScroll() / 2));

	await expect.poll(() => Math.abs(firstRowInView() - 150_000)).toBeLessThan(200);
	const offsets = loadRows.mock.calls.map((call) => call[0]);
	expect(offsets.some((offset) => Math.abs(offset - 150_000) < 1_000)).toBe(true);
	expect(offsets).not.toContain(50_000);
});

test('shows placeholders for rows that have not loaded yet', async () => {
	const loadRows = vi.fn(() => new Promise<string[][]>(() => {}));
	render(VirtualDataGrid, { props: { columns, totalRows: 1000, loadRows } });

	await expect.element(page.getByTestId('grid-placeholder').first()).toBeVisible();
});

test('never asks for the same page twice', async () => {
	const loadRows = source(1000);
	render(VirtualDataGrid, { props: { columns, totalRows: 1000, loadRows, pageSize: 500 } });
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(100);
	await scrollTo(200);

	expect(loadRows.mock.calls.filter((call) => call[0] === 0)).toHaveLength(1);
});

test('offers to try again when rows could not be loaded, and does not show the error', async () => {
	const loadRows = vi
		.fn()
		.mockRejectedValueOnce(new Error('internal detail'))
		.mockImplementation(async (offset: number, limit: number) => makeRows(offset, limit, 1000));
	render(VirtualDataGrid, { props: { columns, totalRows: 1000, loadRows } });

	await expect.element(page.getByRole('alert')).toHaveTextContent('Some rows could not be loaded.');
	await expect.element(page.getByText('internal detail')).not.toBeInTheDocument();

	await page.getByRole('button', { name: 'Try again' }).click();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
});

/** The grid inside a container of a set height, as it sits in a page. */
function renderInHost(totalRows = 5000, height = '300px') {
	const host = document.createElement('div');
	host.style.cssText = `height:${height};width:640px;`;
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: { columns, totalRows, loadRows: source(totalRows), fill: true }
	});
	return host;
}

const frame = () => document.querySelector<HTMLElement>('[role="grid"]')!;
const frameRect = () => frame().getBoundingClientRect();
const header = () => document.querySelector<HTMLElement>('[data-testid="grid-header"]')!;
const card = () => header().firstElementChild as HTMLElement;
const rect = (el: Element) => el.getBoundingClientRect();

test('lays the header over the rows, outside the scrolling area, so it cannot scroll away', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(getComputedStyle(header()).position).toBe('absolute');
	expect(viewport().contains(header())).toBe(false);
	expect(frame().contains(header())).toBe(true);
});

test('fills the height of its container and scrolls the rows inside it', async () => {
	const host = renderInHost(5000, '300px');
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(rect(frame()).height).toBeGreaterThan(200);
	expect(rect(frame()).bottom).toBeLessThanOrEqual(rect(host).bottom + 1);
	expect(viewport().scrollHeight).toBeGreaterThan(viewport().clientHeight);
	expect(host.scrollHeight).toBeLessThanOrEqual(host.clientHeight + 1);
});

test('is attached to the top of the frame, edge to edge, until the rows scroll', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Inside the frame's 1px border.
	expect(rect(card()).top - rect(frame()).top).toBeLessThanOrEqual(1);
	expect(rect(card()).left - rect(frame()).left).toBeLessThanOrEqual(1);
	// No visible shadow: `none`, or Tailwind's list of zero-size, see-through ones.
	expect(getComputedStyle(card()).boxShadow).toMatch(
		/^(none|(rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?)+)$/
	);
	expect(getComputedStyle(card()).borderTopColor).toBe('rgba(0, 0, 0, 0)');
});

test('lifts into a card 4px in from the top and the sides once the rows scroll', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(200);

	await expect.poll(() => Math.round(rect(card()).top - rect(frame()).top)).toBe(5);
	await expect.poll(() => Math.round(rect(card()).left - rect(frame()).left)).toBe(5);
	await expect.poll(() => getComputedStyle(card()).boxShadow).not.toBe('none');
	expect(getComputedStyle(card()).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
});

test('stays pinned to the top of the frame however far the rows scroll', async () => {
	renderInHost(400_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	for (const wanted of [2_000, 1_000_000, 8_000_000, Number.POSITIVE_INFINITY]) {
		const top = Math.min(wanted, maxScroll());
		await scrollTo(top);
		await expect.poll(() => Math.round(viewport().scrollTop)).toBeGreaterThan(top - 100);
		// The lift eases over most of a second, so wait for it to finish.
		await expect.poll(() => Math.round(rect(card()).top - rect(frame()).top)).toBe(5);
	}
});

test('settles back flush with the frame when scrolled back to the top', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(300);
	await expect.poll(() => Math.round(rect(card()).top - rect(frame()).top)).toBe(5);
	await scrollTo(0);

	await expect.poll(() => Math.round(rect(card()).top - rect(frame()).top)).toBeLessThanOrEqual(1);
});

test('keeps the rows from jumping when the header lifts', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	const rowTop = () =>
		rect(page.getByRole('gridcell', { name: 'Person 5', exact: true }).element()).top;

	const before = rowTop();
	await scrollTo(1);
	await expect.poll(() => Math.round(rect(card()).top - rect(frame()).top)).toBe(5);

	// One pixel of scrolling moves the rows one pixel, and nothing else.
	expect(Math.round(before - rowTop())).toBe(1);
});

test('lets the pointer through the header, so the wheel still scrolls the rows', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(getComputedStyle(header()).pointerEvents).toBe('none');
});

test('slides the header sideways with the columns when the grid is wider than its frame', async () => {
	const host = document.createElement('div');
	host.style.cssText = 'height:300px;width:300px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: {
			columns: ['A', 'B', 'C', 'D', 'E'],
			totalRows: 100,
			loadRows: source(100),
			fill: true
		}
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	expect(viewport().scrollWidth).toBeGreaterThan(viewport().clientWidth);

	const before = rect(page.getByRole('columnheader', { name: 'E' }).element()).left;
	viewport().scrollLeft = 120;
	viewport().dispatchEvent(new Event('scroll'));

	await expect
		.poll(() =>
			Math.round(before - rect(page.getByRole('columnheader', { name: 'E' }).element()).left)
		)
		.toBe(120);
});

test('eases the header into its card over a good while, not all at once', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(parseFloat(getComputedStyle(card()).transitionDuration)).toBeGreaterThanOrEqual(0.5);
	expect(parseFloat(getComputedStyle(header()).transitionDuration)).toBeGreaterThanOrEqual(0.5);

	await scrollTo(200);
	// Part way through, it has moved some of the way and not all of it.
	await new Promise((r) => setTimeout(r, 120));
	const early = rect(card()).top - rect(frame()).top;
	expect(early).toBeGreaterThan(1);
	expect(early).toBeLessThan(5);
	await expect.poll(() => Math.round(rect(card()).top - rect(frame()).top)).toBe(5);
});

test('shows the normal arrow over the header text, not the text cursor', async () => {
	renderInHost();
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	for (const name of ['#', 'Name', 'Phone']) {
		const cell = page.getByRole('columnheader', { name, exact: true }).element();
		expect(getComputedStyle(cell).cursor).toBe('default');
	}
	expect(getComputedStyle(card()).userSelect).toBe('none');
});

test('has no page buttons unless asked for', async () => {
	render(VirtualDataGrid, { props: { columns, totalRows: 2000, loadRows: source(2000) } });
	await expect.element(page.getByRole('navigation')).not.toBeInTheDocument();
});

test('page buttons jump to a row and follow the scroll', async () => {
	render(VirtualDataGrid, {
		props: { columns, totalRows: 2000, jumpSize: 100, pageJumper: true, loadRows: source(2000) }
	});
	await expect
		.element(page.getByRole('button', { name: 'Jump to Top' }))
		.toHaveAttribute('aria-current', 'true');

	await page.getByRole('button', { name: 'Jump to 300' }).click();
	await expect.poll(() => viewport().scrollTop).toBe(299 * 45);
	await expect
		.element(page.getByRole('button', { name: 'Jump to 300' }))
		.toHaveAttribute('aria-current', 'true');

	await scrollTo(499 * 45);
	await expect
		.element(page.getByRole('button', { name: 'Jump to 500' }))
		.toHaveAttribute('aria-current', 'true');
});

test('the chevrons step one page at a time', async () => {
	render(VirtualDataGrid, {
		props: { columns, totalRows: 2000, jumpSize: 100, pageJumper: true, loadRows: source(2000) }
	});
	await expect.element(page.getByRole('button', { name: 'Previous section' })).toBeDisabled();
	await page.getByRole('button', { name: 'Next section' }).click();
	await expect.poll(() => viewport().scrollTop).toBe(99 * 45);
});

test('a page button puts the row with that id first under the header', async () => {
	render(VirtualDataGrid, {
		props: { columns, totalRows: 5000, jumpSize: 1000, pageJumper: true, loadRows: source(5000) }
	});
	await page.getByRole('button', { name: 'Jump to 1,000' }).click();
	await expect.element(page.getByText('Person 1000', { exact: true })).toBeVisible();
	const frame = viewport().getBoundingClientRect();
	const rows = Array.from(document.querySelectorAll<HTMLElement>('[role="row"][aria-rowindex]'))
		.filter((row) => row.getBoundingClientRect().top >= frame.top + 44)
		.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
	// aria-rowindex is the row id plus 1, for the header
	expect(rows[0].getAttribute('aria-rowindex')).toBe('1001');
});

test('the page size starts at 1000 and the dropdown changes it', async () => {
	render(VirtualDataGrid, {
		props: { columns, totalRows: 5000, pageJumper: true, loadRows: source(5000) }
	});
	await expect.element(page.getByRole('button', { name: 'Jump to 1,000' })).toBeVisible();

	await page.getByRole('button', { name: 'Page size' }).click();
	await page.getByRole('option', { name: '100', exact: true }).click();
	await page.getByRole('button', { name: 'Jump to 100', exact: true }).click();
	await expect.poll(() => viewport().scrollTop).toBe(99 * 45);
});

test('a jump loads the rows it lands on before scrolling there', async () => {
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => (release = resolve));
	const loadRows = vi.fn(async (offset: number, limit: number) => {
		if (offset > 0) await gate;
		return makeRows(offset, limit, 5000);
	});
	render(VirtualDataGrid, {
		props: { columns, totalRows: 5000, jumpSize: 1000, pageJumper: true, loadRows }
	});
	await page.getByRole('button', { name: 'Jump to 1,000' }).click();

	// Asked for the rows from index 999, and not scrolled while they load.
	await expect
		.poll(() => loadRows.mock.calls.some(([offset]) => offset <= 999 && offset + 200 > 999))
		.toBe(true);
	expect(viewport().scrollTop).toBe(0);

	release();
	await expect.poll(() => viewport().scrollTop).toBe(999 * 45);
	await expect.element(page.getByText('Person 1000', { exact: true })).toBeVisible();
});

test('turns off scroll anchoring, which moved Firefox off the row a jump landed on', async () => {
	render(VirtualDataGrid, { props: { columns, totalRows: 100, loadRows: source(100) } });
	await expect.element(page.getByTestId('grid-viewport')).toBeInTheDocument();
	expect(getComputedStyle(viewport()).overflowAnchor).toBe('none');
});

test('clicking the same page button again stays on its row', async () => {
	render(VirtualDataGrid, {
		props: { columns, totalRows: 5000, jumpSize: 1000, pageJumper: true, loadRows: source(5000) }
	});
	const button = page.getByRole('button', { name: 'Jump to 1,000' });
	await button.click();
	await expect.poll(() => viewport().scrollTop).toBe(999 * 45);
	await button.click();
	await button.click();
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(viewport().scrollTop).toBe(999 * 45);
});

test('holds the scroll area under the height some browsers stop scrolling at', async () => {
	renderInHost(400_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// 400,000 rows at full size would be 18,000,000px, past the 16,777,216px limit.
	expect(viewport().scrollHeight).toBeLessThan(16_777_216);
	expect(viewport().scrollHeight).toBeLessThanOrEqual(10_000_045);
});

test('still scrolls a file that fits one to one', async () => {
	renderInHost(5000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Every row at full size, plus the room for the header.
	expect(viewport().scrollHeight).toBe(5000 * 45 + 45);
	await scrollTo(45 * 100);
	await expect.poll(() => firstRowInView()).toBe(100);
});

test('reaches the last row of a file too tall to scroll at full size', async () => {
	renderInHost(400_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(maxScroll());

	await expect
		.element(page.getByRole('gridcell', { name: 'Person 400000', exact: true }))
		.toBeVisible();
	expect(document.querySelector('[role="row"][aria-rowindex="400001"]')).not.toBeNull();
	// Nothing is drawn past the last row.
	expect(document.querySelector('[role="row"][aria-rowindex="400002"]')).toBeNull();
});

test('reaches rows past where one to one scrolling would have stopped', async () => {
	renderInHost(400_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// 372,827 rows is as far as 16,777,216px goes.
	await scrollTo(Math.round(maxScroll() * 0.95));

	await expect.poll(() => firstRowInView()).toBeGreaterThan(372_827);
	await expect.poll(() => firstRowInView()).toBeLessThan(400_000);
});

test('puts the first row at the top and the middle of the scroll bar in the middle of the file', async () => {
	renderInHost(400_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	expect(firstRowInView()).toBe(0);

	await scrollTo(Math.round(maxScroll() / 2));

	await expect.poll(() => Math.abs(firstRowInView() - 200_000)).toBeLessThan(200);
});

test('keeps the rows on screen as the scroll bar moves through a file too tall to scroll at full size', async () => {
	renderInHost(400_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	for (const fraction of [0.1, 0.33, 0.5, 0.8, 1]) {
		await scrollTo(Math.round(maxScroll() * fraction));
		await expect
			.poll(() => document.querySelectorAll('[role="gridcell"]').length)
			.toBeGreaterThan(0);
		// A row is always showing under the header, close to where the scroll bar says it should be.
		await expect
			.poll(() => Math.abs(firstRowInView() - fraction * 400_000))
			.toBeLessThan(400_000 * 0.01 + 200);
		const frame = viewport().getBoundingClientRect();
		const visible = Array.from(document.querySelectorAll<HTMLElement>('[role="gridcell"]')).some(
			(cell) =>
				cell.getBoundingClientRect().top > frame.top + 40 &&
				cell.getBoundingClientRect().bottom < frame.bottom
		);
		expect(visible).toBe(true);
	}
});

test('a page button in a huge file lands on its row', async () => {
	// `fill` needs a container with a height of its own to fill.
	const host = document.createElement('div');
	host.style.cssText = 'height:400px;width:700px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: {
			columns,
			totalRows: 400_000,
			jumpSize: 100_000,
			pageJumper: true,
			fill: true,
			loadRows: source(400_000)
		}
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Jump to 300,000' }).click();

	// The row with id 300,000 is first under the header (index 299,999), give or take a row for
	// the fractions of a pixel the scrolling is rounded to.
	await expect.poll(() => firstRowInView()).toBeGreaterThanOrEqual(299_998);
	await expect.poll(() => firstRowInView()).toBeLessThanOrEqual(300_001);
	await expect
		.element(page.getByRole('button', { name: 'Jump to 300,000' }))
		.toHaveAttribute('aria-current', 'true');
});

test('jumping to the last page of a huge file shows the end of it', async () => {
	// `fill` needs a container with a height of its own to fill.
	const host = document.createElement('div');
	host.style.cssText = 'height:400px;width:700px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: {
			columns,
			totalRows: 400_000,
			jumpSize: 100_000,
			pageJumper: true,
			fill: true,
			loadRows: source(400_000)
		}
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Jump to 400,000' }).click();

	await expect.poll(() => firstRowInView()).toBeGreaterThanOrEqual(399_990);
});

test('drops pages far from the view once it holds more than it was told to keep', async () => {
	const loadRows = source(100_000);
	const host = document.createElement('div');
	host.style.cssText = 'height:300px;width:640px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: { columns, totalRows: 100_000, loadRows, cachedPages: 3, fill: true }
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	const loadsOfFirstPage = () => loadRows.mock.calls.filter(([offset]) => offset === 0).length;
	expect(loadsOfFirstPage()).toBe(1);

	// Go well away from the top, a few times, so the first page is far from the view.
	for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
		await scrollTo(Math.round(maxScroll() * fraction));
		await expect.poll(() => Math.abs(firstRowInView() - fraction * 100_000)).toBeLessThan(1_000);
		await expect
			.poll(() => document.querySelectorAll('[data-testid="grid-placeholder"]').length)
			.toBe(0);
	}

	await scrollTo(0);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	// It had been dropped, so going back asked for it again.
	expect(loadsOfFirstPage()).toBe(2);
});

test('keeps pages near the view, so scrolling a little costs no new loads', async () => {
	const loadRows = source(100_000);
	const host = document.createElement('div');
	host.style.cssText = 'height:300px;width:640px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: { columns, totalRows: 100_000, loadRows, cachedPages: 3, fill: true }
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(45 * 30);
	await scrollTo(0);
	await scrollTo(45 * 30);
	await expect
		.element(page.getByRole('gridcell', { name: 'Person 31', exact: true }))
		.toBeVisible();

	// Rows 0 to 199 were loaded once, however the view went back and forth over them.
	expect(loadRows.mock.calls.filter(([offset]) => offset === 0)).toHaveLength(1);
});

test('never drops a page that is on screen, even when asked to keep very few', async () => {
	const loadRows = source(100_000);
	const host = document.createElement('div');
	host.style.cssText = 'height:600px;width:640px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: { columns, totalRows: 100_000, loadRows, cachedPages: 1, pageSize: 5, fill: true }
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Let it settle: with 5 rows a page, a screenful spans many pages, and none may flicker back.
	await new Promise((resolve) => setTimeout(resolve, 400));
	const calls = loadRows.mock.calls.length;
	await new Promise((resolve) => setTimeout(resolve, 400));

	expect(document.querySelectorAll('[data-testid="grid-placeholder"]')).toHaveLength(0);
	// No loop of dropping and loading the same pages.
	expect(loadRows.mock.calls.length).toBe(calls);
});

test('a jump keeps the pages it loaded for its landing, though they are far from where the view was', async () => {
	const loadRows = source(100_000);
	const host = document.createElement('div');
	host.style.cssText = 'height:400px;width:700px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: {
			columns,
			totalRows: 100_000,
			loadRows,
			cachedPages: 3,
			jumpSize: 10_000,
			pageJumper: true,
			fill: true
		}
	});
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Jump to 50,000' }).click();

	await expect.poll(() => firstRowInView()).toBeGreaterThanOrEqual(49_998);
	await expect
		.element(page.getByRole('gridcell', { name: 'Person 50000', exact: true }))
		.toBeVisible();
	// It lands on real rows, not placeholders waiting to load again.
	expect(document.querySelectorAll('[data-testid="grid-placeholder"]')).toHaveLength(0);
});

/** A grid with page buttons in a container of a given width, as on a phone or a desk. */
function renderJumperIn(width: number, totalRows = 50_000) {
	const host = document.createElement('div');
	host.style.cssText = `height:420px;width:${width}px;`;
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: {
			columns,
			totalRows,
			jumpSize: 1000,
			pageJumper: true,
			fill: true,
			loadRows: source(totalRows)
		}
	});
	return host;
}
const jumperNav = () => document.querySelector<HTMLElement>('nav[aria-label="Jump to rows"]')!;
const pageSize = () => document.querySelector<HTMLElement>('button[aria-label="Page size"]')!;
const clipWidth = () =>
	Math.round(
		jumperNav().querySelector<HTMLElement>('.overflow-hidden')!.getBoundingClientRect().width
	);

test('on a wide grid the page buttons are the normal size, five at a time', async () => {
	renderJumperIn(900);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(clipWidth()).toBe(5 * 40);
	expect(
		Math.round(
			page.getByRole('button', { name: 'Next section' }).element().getBoundingClientRect().height
		)
	).toBe(32);
});

test('on a narrow grid the page buttons are finger sized, and three at a time', async () => {
	renderJumperIn(360);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(clipWidth()).toBe(3 * 44);
	const chevron = page
		.getByRole('button', { name: 'Next section' })
		.element()
		.getBoundingClientRect();
	expect(Math.round(chevron.width)).toBeGreaterThanOrEqual(44);
	expect(Math.round(chevron.height)).toBeGreaterThanOrEqual(44);
	expect(Math.round(pageSize().getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

test.each([320, 360, 390])(
	'at %ipx the page size dropdown and buttons stay inside the grid',
	async (width) => {
		renderJumperIn(width);
		await expect
			.element(page.getByRole('gridcell', { name: 'Person 1', exact: true }))
			.toBeVisible();

		const frame = frameRect();
		for (const el of [jumperNav(), pageSize()]) {
			const box = el.getBoundingClientRect();
			expect(box.left).toBeGreaterThanOrEqual(frame.left);
			expect(box.right).toBeLessThanOrEqual(frame.right);
		}
	}
);

test('on a narrow grid the page size dropdown wraps above the buttons', async () => {
	renderJumperIn(320);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(pageSize().getBoundingClientRect().bottom).toBeLessThanOrEqual(
		jumperNav().getBoundingClientRect().top + 1
	);
});

test('on a narrow grid the page size dropdown and buttons are centered as a group', async () => {
	renderJumperIn(360);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Whether they share a line or wrap onto two, the group's edges are as far from the frame's.
	const frame = frameRect();
	const parts = [jumperNav(), pageSize()].map((el) => el.getBoundingClientRect());
	const left = Math.min(...parts.map((box) => box.left)) - frame.left;
	const right = frame.right - Math.max(...parts.map((box) => box.right));
	expect(Math.abs(left - right)).toBeLessThan(24);
});

test('on a wide grid the page buttons stay at the left', async () => {
	renderJumperIn(900);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	expect(jumperNav().getBoundingClientRect().left - frameRect().left).toBeLessThan(160);
});

test('a page button still jumps on a narrow grid', async () => {
	renderJumperIn(360);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Jump to 2,000' }).click();

	await expect.poll(() => firstRowInView()).toBeGreaterThanOrEqual(1998);
	await expect.poll(() => firstRowInView()).toBeLessThanOrEqual(2001);
});

/** A grid with page buttons of 1,000 rows each, in a container tall enough for about eight rows. */
function renderPagesIn(totalRows: number, jumpSize = 1000) {
	const host = document.createElement('div');
	host.style.cssText = 'height:420px;width:900px;';
	document.body.appendChild(host);
	render(VirtualDataGrid, {
		target: host,
		props: {
			columns,
			totalRows,
			jumpSize,
			pageJumper: true,
			fill: true,
			loadRows: source(totalRows)
		}
	});
}
const pageButton = (name: string) => page.getByRole('button', { name });

test('highlights the page at the top of the view, as before, away from the end', async () => {
	renderPagesIn(1005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await expect.element(pageButton('Jump to Top')).toHaveAttribute('aria-current', 'true');
	await expect.element(pageButton('Jump to 1,000')).not.toHaveAttribute('aria-current');
});

test('highlights the last page at the end of the list, though its first row can never reach the top', async () => {
	renderPagesIn(1002);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Only 3 rows follow row 1,000. The view shows about 8 and the room kept clear for the page
	// buttons is a little more than one, so it still cannot be at the top.
	await scrollTo(maxScroll());

	await expect.poll(() => firstRowInView()).toBeLessThan(999);
	await expect.element(pageButton('Jump to 1,000')).toHaveAttribute('aria-current', 'true');
	await expect.element(pageButton('Jump to Top')).not.toHaveAttribute('aria-current');
});

test('moves back off the last page when the rows scroll up from the end', async () => {
	renderPagesIn(1005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();
	await scrollTo(maxScroll());
	await expect.element(pageButton('Jump to 1,000')).toHaveAttribute('aria-current', 'true');

	await scrollTo(45 * 500);

	await expect.element(pageButton('Jump to Top')).toHaveAttribute('aria-current', 'true');
	await expect.element(pageButton('Jump to 1,000')).not.toHaveAttribute('aria-current');
});

test('does not call a page the last one just for being close to the end', async () => {
	renderPagesIn(3005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// A little short of the end: row 3,000 would be near the top, and that is the page it is on.
	await scrollTo(maxScroll() - 45 * 20);

	await expect.element(pageButton('Jump to 2,000')).toHaveAttribute('aria-current', 'true');
	await expect.element(pageButton('Jump to 3,000')).not.toHaveAttribute('aria-current');
});

test('highlights the last page at the end of a huge file, too', async () => {
	renderPagesIn(400_000, 100_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(maxScroll());

	await expect.element(pageButton('Jump to 400,000')).toHaveAttribute('aria-current', 'true');
	await expect.element(pageButton('Jump to 300,000')).not.toHaveAttribute('aria-current');
});

test('clicking the last page leaves it highlighted once the rows land at the end', async () => {
	renderPagesIn(1005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await pageButton('Jump to 1,000').click();

	await expect.poll(() => Math.round(viewport().scrollTop)).toBeGreaterThan(maxScroll() - 2);
	await expect.element(pageButton('Jump to 1,000')).toHaveAttribute('aria-current', 'true');
});

/** The cell of the last row of the file, by its name, and the page buttons' top edge. */
const lastRowCell = (name: string) =>
	page.getByRole('gridcell', { name, exact: true }).element().getBoundingClientRect();
/** The highest point of what floats at the bottom: the size dropdown or the page buttons. */
function floatingTop() {
	return Math.min(jumperNav().getBoundingClientRect().top, pageSize().getBoundingClientRect().top);
}

test('leaves the last row clear of the page buttons at the end of the list', async () => {
	renderPagesIn(1005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(maxScroll());

	await expect
		.element(page.getByRole('gridcell', { name: 'Person 1005', exact: true }))
		.toBeVisible();
	// Its whole row is above the buttons, not under them.
	expect(lastRowCell('Person 1005').bottom).toBeLessThanOrEqual(floatingTop());
});

test('leaves the last row clear on a narrow grid, where the buttons are taller because they wrap', async () => {
	renderJumperIn(320, 1005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(maxScroll());

	await expect
		.element(page.getByRole('gridcell', { name: 'Person 1005', exact: true }))
		.toBeVisible();
	expect(lastRowCell('Person 1005').bottom).toBeLessThanOrEqual(floatingTop());
});

test('leaves the last row clear at the end of a huge file, too', async () => {
	renderPagesIn(400_000, 100_000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(maxScroll());

	await expect
		.element(page.getByRole('gridcell', { name: 'Person 400000', exact: true }))
		.toBeVisible();
	expect(lastRowCell('Person 400000').bottom).toBeLessThanOrEqual(floatingTop());
});

test('adds room at the bottom only when there are page buttons to clear', async () => {
	renderInHost(5000);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	// Every row, plus the room for the header and nothing else.
	expect(viewport().scrollHeight).toBe(5000 * 45 + 45);
	await scrollTo(maxScroll());
	await expect
		.element(page.getByRole('gridcell', { name: 'Person 5000', exact: true }))
		.toBeVisible();
	const frame = viewport().getBoundingClientRect();
	expect(lastRowCell('Person 5000').bottom).toBeGreaterThan(frame.bottom - 50);
});

test('still reaches the first row at the top with the room at the bottom', async () => {
	renderPagesIn(1005);
	await expect.element(page.getByRole('gridcell', { name: 'Person 1', exact: true })).toBeVisible();

	await scrollTo(maxScroll());
	await scrollTo(0);

	await expect.poll(() => firstRowInView()).toBe(0);
});
