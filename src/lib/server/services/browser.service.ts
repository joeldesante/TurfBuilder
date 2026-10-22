import puppeteer, { type Browser } from 'puppeteer';
import { logger } from '$lib/server/logger';

/** Chrome processes this server has open right now; each one costs hundreds of MB. */
let activeBrowsers = 0;

/**
 * Launches headless Chrome for the PDF and map engines.
 *
 * The browser binary comes from PUPPETEER_EXECUTABLE_PATH when set (the
 * Docker images point it at Alpine's chromium, since Puppeteer's own download
 * does not run on musl). Chrome refuses to sandbox itself as root, which is
 * how the containers run, so the sandbox is dropped only in that case.
 */
export async function launchBrowser(args: string[] = []): Promise<Browser> {
	const runningAsRoot = process.getuid?.() === 0;
	const startedAt = performance.now();
	const browser = await puppeteer.launch({ args: runningAsRoot ? ['--no-sandbox', ...args] : args });

	activeBrowsers += 1;
	logger.info(
		{ activeBrowsers, launchMs: Math.round(performance.now() - startedAt) },
		'Chrome launched'
	);
	// Fires however it ends: closed on purpose, crashed, or killed.
	browser.once('disconnected', () => {
		activeBrowsers -= 1;
		logger.info({ activeBrowsers }, 'Chrome closed');
	});
	return browser;
}
