import { describe, it, expect, vi, beforeEach } from 'vitest';

const { page, browser, launchBrowser } = vi.hoisted(() => {
	const page = {
		setContent: vi.fn(),
		pdf: vi.fn()
	};
	const browser = { newPage: vi.fn(async () => page), close: vi.fn() };
	return { page, browser, launchBrowser: vi.fn(async () => browser) };
});

vi.mock('./browser', () => ({ launchBrowser }));

import { generatePDF } from './pdf-engine.service';

beforeEach(() => {
	vi.clearAllMocks();
	page.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});

describe('generatePDF', () => {
	it('fills the template with the data and prints it on Letter paper', async () => {
		const pdf = await generatePDF('<h1>{{list.name}}</h1>', { list: { name: 'Main St' } });

		expect(page.setContent).toHaveBeenCalledWith('<h1>Main St</h1>');
		expect(page.pdf).toHaveBeenCalledWith({ format: 'Letter', printBackground: true });
		expect(pdf).toEqual(new Uint8Array([37, 80, 68, 70]));
	});

	// Names come from users and the page renders in server-side Chrome, so
	// markup in the data must never become live HTML.
	it('escapes html in the data', async () => {
		await generatePDF('<p>{{name}}</p>', { name: '<script>fetch("http://internal")</script>' });

		const html = page.setContent.mock.calls[0][0] as string;
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('closes the browser even when printing fails', async () => {
		page.pdf.mockRejectedValue(new Error('print failed'));

		await expect(generatePDF('<p></p>', {})).rejects.toThrow('print failed');
		expect(browser.close).toHaveBeenCalledOnce();
	});

	// The service aborts a document that runs past its deadline.
	it('closes the browser when aborted mid-render, so the render stops', async () => {
		const controller = new AbortController();
		page.pdf.mockImplementation(() => {
			controller.abort();
			return new Promise(() => {});
		});

		void generatePDF('<p></p>', {}, { signal: controller.signal });
		await vi.waitFor(() => expect(browser.close).toHaveBeenCalled());
	});

	it('does not start Chrome when already aborted', async () => {
		const controller = new AbortController();
		controller.abort(new Error('too late'));

		await expect(generatePDF('<p></p>', {}, { signal: controller.signal })).rejects.toThrow(
			'too late'
		);
		expect(launchBrowser).not.toHaveBeenCalled();
	});
});
