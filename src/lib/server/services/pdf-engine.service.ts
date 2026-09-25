import Handlebars from 'handlebars';
import { launchBrowser } from './browser';

/**
 * Fills a Handlebars template with the data and prints it as a Letter PDF.
 * Aborting `signal` closes the browser, so a render that has run too long
 * stops instead of lingering.
 */
export async function generatePDF(
	template: string,
	data: Record<string, unknown>,
	{ signal }: { signal?: AbortSignal } = {}
): Promise<Uint8Array> {
	signal?.throwIfAborted();
	const html = Handlebars.compile(template)(data);

	const browser = await launchBrowser();
	const onAbort = () => void browser.close();
	signal?.addEventListener('abort', onAbort, { once: true });
	try {
		const page = await browser.newPage();
		await page.setContent(html);
		return await page.pdf({ format: 'Letter', printBackground: true });
	} finally {
		signal?.removeEventListener('abort', onAbort);
		await browser.close();
	}
}
