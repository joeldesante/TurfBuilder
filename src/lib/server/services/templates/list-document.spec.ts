import { describe, it, expect } from 'vitest';
import Handlebars from 'handlebars';
import TEMPLATE from './list-document.html?raw';

const location = (number: number, name = `Shop ${number}`) => ({
	number,
	name,
	address: `${number} Main St, Springfield, PA 19064`
});

const base = {
	list: { name: 'Downtown' },
	generatedAt: 'Sep 24, 2026 3:15 PM',
	expires: { date: 'Oct 8, 2026', time: '11:59 PM', timezone: 'EDT' },
	locations: [location(1), location(2)],
	turfs: [] as { code: string; map?: string; locations: ReturnType<typeof location>[] }[]
};

function render(data: object): string {
	return Handlebars.compile(TEMPLATE)(data);
}

/** Sections that start on a fresh page, in document order. */
function pageBreaks(html: string): number {
	return (html.match(/<section style="break-before: page;">/g) ?? []).length;
}

describe('list document template', () => {
	it('shows the list name, expiry, and every location', () => {
		const html = render(base);

		expect(html).toContain('Downtown');
		expect(html).toContain('<strong>Oct 8, 2026</strong> at <strong>11:59 PM</strong> (EDT)');
		expect(html).toContain('Shop 1');
		expect(html).toContain('2 Main St, Springfield, PA 19064');
	});

	it('leaves out the contents and turf pages when no turfs are cut', () => {
		const html = render(base);

		expect(html).not.toContain('Contents');
		expect(html).not.toContain('Master list of turfs available to canvass');
		expect(pageBreaks(html)).toBe(0);
	});

	it('gives the turf list and every turf its own page', () => {
		const html = render({
			...base,
			turfs: [
				{ code: 'KX7-42B', locations: [location(1)] },
				{ code: 'QP3-19A', locations: [location(1), location(2)] }
			]
		});

		expect(html).toContain('Contents');
		expect(html).toContain('Master list of turfs available to canvass');
		// The turf list, then one per turf.
		expect(pageBreaks(html)).toBe(3);
		expect(html).toContain('Locations: 2');
	});

	// The turf heading repeats on every page a long turf runs onto only because
	// it sits in a table header.
	it('puts each turf heading in a repeating table header', () => {
		const html = render({ ...base, turfs: [{ code: 'KX7-42B', locations: [location(1)] }] });

		const turfPage = html.slice(html.lastIndexOf('<section style="break-before: page;">'));
		expect(turfPage.indexOf('<thead>')).toBeLessThan(turfPage.indexOf('KX7-42B'));
		expect(turfPage.indexOf('KX7-42B')).toBeLessThan(turfPage.indexOf('</thead>'));
	});

	it('includes a map only when one is provided', () => {
		const withMap = render({ ...base, map: 'data:image/jpeg;base64,AAAA' });
		const withoutMap = render(base);

		expect(withMap).toContain('src="data:image/jpeg;base64,AAAA"');
		expect(withoutMap).not.toContain('alt="Map of all locations"');
	});

	// The page renders in server-side Chrome, so user data must never become markup.
	it('escapes html in list and location names', () => {
		const html = render({
			...base,
			list: { name: '<img src=x onerror=alert(1)>' },
			locations: [location(1, '<script>alert(1)</script>')]
		});

		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;script&gt;');
	});

	// An inline <svg> in the fixed footer only prints on the first page.
	it('shows the logo in the footer as an image', () => {
		const markup = render(base).replace(/<!--[\s\S]*?-->/g, '');

		expect(markup).toMatch(/<img src="data:image\/svg\+xml;base64,[^"]+" alt="Turfbuilder"/);
		expect(markup).not.toMatch(/<svg[\s>]/);
	});

	it('uses no external resources, so rendering never waits on the network', () => {
		const html = render(base);

		expect(html).not.toMatch(/(src|href)="https?:/);
	});

	// Notes belong in Handlebars comments, which are stripped; HTML comments
	// would be sent into every generated page.
	it('sends no comments into the rendered page', () => {
		const html = render({ ...base, turfs: [{ code: 'KX7-42B', locations: [location(1)] }] });

		expect(html).not.toContain('<!--');
		expect(html).not.toContain('{{');
	});
});
