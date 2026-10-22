import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { DATABASE_URL } from './config';
import { gotoHydrated, signInAsAdmin } from './helpers';

let db: Client;

test.beforeAll(async () => {
	db = new Client({ connectionString: DATABASE_URL });
	await db.connect();
	// The infra panel, like staff pages, needs a verified email, and tests cannot receive mail.
	await db.query(`UPDATE auth."user" SET email_verified = true WHERE email = 'test@example.com'`);
});

test.afterAll(async () => {
	await db?.end();
});

// The infra API lives outside any layout guard, so each endpoint must refuse signed-out callers itself.
test.describe('signed out', () => {
	for (const path of ['/api/v1/users', '/api/v1/organizations', '/api/v1/metrics/signups', '/api/v1/audit-events', '/api/v1/system-settings', '/api/v1/system-health', '/api/v1/email-logs']) {
		test(`GET ${path} answers 401`, async ({ request }) => {
			expect((await request.get(path)).status()).toBe(401);
		});
	}

	test('the panel sends visitors to sign in', async ({ page }) => {
		await page.goto('/infra');

		await expect(page).toHaveURL(/\/auth\/signin/);
	});
});

test.describe('infrastructure admin', () => {
	test.beforeEach(async ({ page }) => {
		await signInAsAdmin(page);
	});

	test('sees the overview with its headline figures', async ({ page }) => {
		await gotoHydrated(page, '/infra');

		await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Headline figures' })).toBeVisible();
	});

	test('can open every panel page', async ({ page }) => {
		for (const [path, heading] of [
			['/infra/metrics', 'Metrics'],
			['/infra/orgs', 'Organizations'],
			['/infra/users', 'Users'],
			['/infra/admins', 'Admins'],
			['/infra/audit', 'Audit log'],
			['/infra/settings', 'Settings'],
			['/infra/settings/email/templates', 'Email templates'],
			['/infra/settings/email/log', 'Email log'],
			['/infra/system', 'System health']
		]) {
			await gotoHydrated(page, path);
			await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
		}
	});

	test('finds a user and opens their page', async ({ page }) => {
		await gotoHydrated(page, '/infra/users');
		await page.getByRole('searchbox', { name: /Search/ }).fill('test@example.com');
		await page.getByRole('button', { name: 'Search' }).click();
		await page.getByRole('link', { name: /test@example.com/ }).first().click();

		await expect(page).toHaveURL(/\/infra\/users\/[0-9a-f-]{36}/);
		await expect(page.getByRole('button', { name: /Actions/ })).toBeVisible();
	});

	test('has the quick menu on other pages, and a way back to the panel', async ({ page }) => {
		await gotoHydrated(page, '/orgs');
		await page.getByRole('button', { name: /infrastructure/i }).click();
		await page.getByRole('link', { name: 'Users' }).click();

		await expect(page).toHaveURL(/\/infra\/users/);
	});

	test('a settings change is written to the audit log', async ({ page }) => {
		const before = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM infra_audit_log WHERE action = 'settings.update'`)).rows[0].n;

		await gotoHydrated(page, '/infra/settings?tab=activity');
		await page.getByRole('textbox', { name: 'Keep activity for' }).fill('731');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByRole('status')).toContainText('Saved.');

		const after = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM infra_audit_log WHERE action = 'settings.update'`)).rows[0].n;
		expect(after).toBe(before + 1);

		await page.getByRole('textbox', { name: 'Keep activity for' }).fill('730');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByRole('status')).toContainText('Saved.');
	});

	test('rejects a bad setting with a message on the field', async ({ page }) => {
		await gotoHydrated(page, '/infra/settings?tab=email');
		await page.getByRole('textbox', { name: 'Sending domain' }).fill('not a domain');
		await page.getByRole('button', { name: 'Save changes' }).click();

		await expect(page.getByRole('alert').first()).toContainText('domain');
	});
});
