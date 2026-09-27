import puppeteer, { type Browser } from 'puppeteer';

/**
 * Launches headless Chrome for the PDF and map engines.
 *
 * The browser binary comes from PUPPETEER_EXECUTABLE_PATH when set (the
 * Docker images point it at Alpine's chromium, since Puppeteer's own download
 * does not run on musl). Chrome refuses to sandbox itself as root, which is
 * how the containers run, so the sandbox is dropped only in that case.
 */
export function launchBrowser(args: string[] = []): Promise<Browser> {
	const runningAsRoot = process.getuid?.() === 0;
	return puppeteer.launch({ args: runningAsRoot ? ['--no-sandbox', ...args] : args });
}
