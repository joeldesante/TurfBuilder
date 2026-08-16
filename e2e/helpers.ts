import type { Page } from '@playwright/test';

export async function waitForHydration(page: Page, timeout = 60_000): Promise<void> {
	await page.waitForFunction(() => document.body.dataset.hydrated === 'true', undefined, {
		timeout
	});
}

export async function gotoHydrated(page: Page, path: string, timeout = 60_000): Promise<void> {
	await page.goto(path);
	await waitForHydration(page, timeout);
}
