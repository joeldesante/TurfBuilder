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

/** Signs in as the admin account that setup.spec.ts creates. */
export async function signInAsAdmin(page: Page): Promise<void> {
	await gotoHydrated(page, '/auth/signin');
	await page.getByRole('textbox', { name: 'Email or Username' }).fill('test@example.com');
	await page.getByRole('textbox', { name: 'Password' }).fill('Password123');
	await page.getByRole('button', { name: 'Sign In' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/auth/signin'));
}
