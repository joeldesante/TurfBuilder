import type { Page } from '@playwright/test';

// The dev container compiles routes on first request, so the server-rendered HTML can
// arrive seconds before the client bundle. Clicks that land in that window hit markup
// with no event handlers attached and are silently lost. The root layout sets
// data-hydrated on <body> in onMount, which is the first point where handlers exist.
export async function waitForHydration(page: Page, timeout = 60_000): Promise<void> {
	await page.waitForFunction(() => document.body.dataset.hydrated === 'true', undefined, {
		timeout
	});
}

export async function gotoHydrated(page: Page, path: string, timeout = 60_000): Promise<void> {
	await page.goto(path);
	await waitForHydration(page, timeout);
}
