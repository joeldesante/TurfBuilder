import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { DATABASE_URL } from './config';
import { gotoHydrated } from './helpers';

/** Runs an npm script against the e2e database, the way an operator would. */
function npm(args: string[], input?: string): string {
	return execFileSync('npm', ['run', ...args], {
		env: { ...process.env, DATABASE_URL },
		input,
		encoding: 'utf8',
		stdio: ['pipe', 'pipe', 'pipe']
	});
}

test('migrating and setting up the database with the CLI', async ({ page }) => {
	// The database container can still be starting when the app answers.
	await expect(async () => {
		npm(['migrate']);
	}).toPass({ timeout: 60_000 });

	npm(
		[
			'setup',
			'--',
			'--no-input',
			'--password-stdin',
			'--base-url',
			'http://localhost:5173',
			'--app-name',
			'TurfBuilder',
			'--admin-name',
			'Test McGee',
			'--admin-username',
			'testmcgee',
			'--admin-email',
			'test@example.com'
		],
		'Password123\n'
	);

	await gotoHydrated(page, '/auth/signin');
	await expect(page.locator('body')).toMatchAriaSnapshot(`
    - img "Logo"
    - text: Email or Username
    - textbox "Email or Username"
    - text: Password
    - link "Forgot password?":
      - /url: /auth/forgot-password
    - textbox "Password"
    - button "Show password":
      - img
    - button "Sign In"
    - paragraph:
      - text: Don't have an account?
      - link "Sign up":
        - /url: /auth/signup
    - link "Privacy Policy":
      - /url: /privacy
    - link "Terms of Service":
      - /url: /terms
    `);
});

// Runs after the CLI setup above (tests in a file run in order): the rest of
// the test stack. Mail goes to the Mailpit container instead of the internet.
test('pointing outgoing mail at Mailpit', async () => {
	const db = new Client({ connectionString: DATABASE_URL });
	await db.connect();
	try {
		await db.query(
			`INSERT INTO system_setting (key, value, description)
			 SELECT k, v, 'e2e' FROM unnest($1::text[], $2::text[]) AS t(k, v)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
			[
				['mail.transport', 'mail.domain', 'mail.smtp.host', 'mail.smtp.port', 'mail.smtp.secure'],
				['smtp', 'example.test', 'mailpit', '1025', 'false']
			]
		);
		const { rows } = await db.query(
			`SELECT value FROM system_setting WHERE key = 'mail.transport'`
		);
		expect(rows[0].value).toBe('smtp');
	} finally {
		await db.end();
	}
});
