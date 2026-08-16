import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { DATABASE_URL } from './config';
import { gotoHydrated } from './helpers';

// Serial so the signed-in session from the first test carries into the second.
test.describe.configure({ mode: 'serial' });

let db: Client;
let page: Page;

test.beforeAll(async ({ browser }) => {
	db = new Client({ connectionString: DATABASE_URL });
	await db.connect();
	page = await browser.newPage();
});

test.afterAll(async () => {
	await db?.end();
	await page?.close();
});

test('sign in to admin account created on setup', async () => {
	const sessionsBefore = await db.query<{ count: number }>(
		`SELECT count(*)::int AS count
		 FROM auth.session s
		 JOIN auth.user u ON u.id = s.user_id
		 WHERE u.email = $1`,
		['test@example.com']
	);

	await gotoHydrated(page, '/auth/signin');
	await page.getByRole('textbox', { name: 'Email or Username' }).fill('test@example.com');
	await page.getByRole('textbox', { name: 'Password' }).fill('Password123');
	await page.getByRole('button', { name: 'Sign In' }).click();

	await page.waitForURL((url) => !url.pathname.startsWith('/auth/signin'));

	const cookies = await page.context().cookies();
	const sessionCookie = cookies.find((c) => c.name === 'better-auth.session_token');
	expect(sessionCookie?.value).toBeTruthy();

	const { rows } = await db.query<{ token: string; expires_at: Date }>(
		`SELECT s.token, s.expires_at
		 FROM auth.session s
		 JOIN auth.user u ON u.id = s.user_id
		 WHERE u.email = $1
		 ORDER BY s.created_at DESC`,
		['test@example.com']
	);

	expect(rows.length).toBe(sessionsBefore.rows[0].count + 1);
	expect(rows[0].expires_at.getTime()).toBeGreaterThan(Date.now());

	// The cookie carries the session token plus a signature: "<token>.<sig>".
	expect(decodeURIComponent(sessionCookie!.value).split('.')[0]).toBe(rows[0].token);
});

test('signing in again is bypassed once a session exists', async () => {
	await page.goto('/auth/signin');
	await expect(page).toHaveURL(/\/orgs$/);
});
