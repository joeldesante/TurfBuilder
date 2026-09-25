import Handlebars from 'handlebars';
import { launchBrowser } from './browser';

export async function generatePDF(
	template: string,
	data: Record<string, unknown>
): Promise<Uint8Array> {
	const html = Handlebars.compile(template)(data);

	const browser = await launchBrowser();
	try {
		const page = await browser.newPage();
		await page.setContent(html);
		return await page.pdf({ format: 'Letter', printBackground: true });
	} finally {
		await browser.close();
	}
}
