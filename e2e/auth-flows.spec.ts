import { test, expect } from './fixtures';
import { gotoHydrated, waitForHydration } from './helpers';
import { linkIn, mailCount, waitForMail } from './fixtures/mail';
import { suffix } from './fixtures/world';
import { nextTotp, secretOf, totp } from './fixtures/totp';

// Signing up, verifying, signing in and out, resetting a password, 2FA, and
// the fake-email update. Mail is read from Mailpit.

async function fillSignIn(page: import('@playwright/test').Page, identifier: string, password: string) {
	await page.getByRole('textbox', { name: 'Email or Username' }).fill(identifier);
	await page.getByRole('textbox', { name: 'Password' }).fill(password);
	await page.getByRole('button', { name: 'Sign In' }).click();
}


/** Turns on two-factor through /auth/2fa/setup and returns the TOTP secret and the backup codes. */
async function setUpTwoFactor(
	page: import('@playwright/test').Page,
	password: string
): Promise<{ secret: string; backupCodes: string[] }> {
	await gotoHydrated(page, '/auth/2fa/setup');
	await page.getByLabel('Please enter your password.').fill(password);
	await page.getByRole('button', { name: 'Authorize' }).click();

	const uri = await page.getByRole('link', { name: /add this account/ }).getAttribute('href');
	const secret = secretOf(uri!);
	await page.getByRole('button', { name: 'Next' }).click();

	await expect(page.getByRole('heading', { name: 'Enter your one time passcode' })).toBeVisible();
	await page.locator('input[autocomplete="one-time-code"]').pressSequentially(totp(secret));
	await expect(page.getByText('Please save backup these codes in a safe place.')).toBeVisible();
	const backupCodes = (await page.locator('pre').allInnerTexts()).map((c) => c.trim());
	return { secret, backupCodes };
}

test('a wrong password shows an error and stays signed out', async ({ world }) => {
	const user = await world.createUser();
	const { page, context } = await world.anonymous();

	await gotoHydrated(page, '/auth/signin');
	await fillSignIn(page, user.email, 'not-the-password');

	await expect(page.locator('.text-error')).not.toBeEmpty();
	await expect(page).toHaveURL(/\/auth\/signin/);
	expect((await context.cookies()).find((c) => c.name.endsWith('session_token'))).toBeUndefined();
});

test('signing in by username works too, and returns to the page asked for', async ({ world }) => {
	const user = await world.createUser();
	const { page } = await world.anonymous();

	await gotoHydrated(page, '/auth/signin?redirectTo=/orgs/join');
	await fillSignIn(page, user.username, user.password);

	await expect(page).toHaveURL(/\/orgs\/join$/);
});

test('signing up sends a verification email, and its link verifies the address', async ({ world, db }) => {
	const s = suffix();
	const email = `e2e-signup-${s}@example.test`;
	const { page } = await world.anonymous();

	await gotoHydrated(page, '/auth/signup');
	await page.getByRole('textbox', { name: 'Email' }).fill(email);
	await page.getByRole('textbox', { name: 'Username' }).fill(`signup${s}`);
	await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Password123!');
	await page.getByRole('textbox', { name: 'Confirm Password' }).fill('Password123!');
	await page.getByRole('button', { name: 'Sign Up' }).click();
	await expect(page).toHaveURL(/\/orgs$/);

	const before = await db.query(`SELECT email_verified FROM auth."user" WHERE email = $1`, [email]);
	expect(before.rows[0].email_verified).toBe(false);

	const mail = await waitForMail(email);
	await page.goto(linkIn(mail, 'verify-email'));

	await expect(async () => {
		const after = await db.query(`SELECT email_verified FROM auth."user" WHERE email = $1`, [email]);
		expect(after.rows[0].email_verified).toBe(true);
	}).toPass();
});

test('an unverified user is sent to verify their email before staff pages, and can resend it', async ({ world }) => {
	const user = await world.createUser({ verified: false });
	const org = await world.createOrg({ owner: user });
	const { page } = await world.signIn(user);
	const sent = await mailCount(user.email);

	await page.goto(`/o/${org.slug}/s`);
	await expect(page).toHaveURL(/\/auth\/verify-email/);
	await waitForHydration(page);
	await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();

	await page.getByRole('button', { name: /Resend verification email/ }).click();
	await expect(page.getByRole('button', { name: /Resend verification email \(\d+s\)/ })).toBeVisible();
	await expect.poll(() => mailCount(user.email)).toBeGreaterThan(sent);

	await page.getByRole('link', { name: 'Organizations' }).click();
	await expect(page).toHaveURL(/\/orgs$/);
});

test('a forgotten password is reset through the emailed link, and the old one stops working', async ({ world }) => {
	const user = await world.createUser();
	const { page } = await world.anonymous();

	await gotoHydrated(page, '/auth/forgot-password');
	await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
	await page.getByRole('button', { name: 'Send reset link' }).click();
	await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

	const mail = await waitForMail(user.email);
	await gotoHydrated(page, linkIn(mail, 'reset-password'));
	await expect(page).toHaveURL(/\/auth\/reset-password/);
	await page.getByRole('textbox', { name: 'New password', exact: true }).fill('NewPassword456!');
	await page.getByRole('textbox', { name: 'Confirm new password' }).fill('NewPassword456!');
	await page.getByRole('button', { name: 'Reset password' }).click();
	await expect(page).toHaveURL(/\/auth\/signin/);

	await gotoHydrated(page, '/auth/signin');
	await fillSignIn(page, user.email, user.password);
	await expect(page.locator('.text-error')).not.toBeEmpty();

	await fillSignIn(page, user.email, 'NewPassword456!');
	await expect(page).toHaveURL(/\/orgs$/);
});

test('a reset link without a token says it is invalid', async ({ world }) => {
	const { page } = await world.anonymous();

	await gotoHydrated(page, '/auth/reset-password');
	await expect(page.getByRole('heading', { name: 'Invalid reset link' })).toBeVisible();
});

test('signing out from the account menu ends the session', async ({ world, db }) => {
	const user = await world.createUser();
	const { page } = await world.signIn(user);

	await gotoHydrated(page, '/orgs');
	await page.getByRole('button', { name: 'Account menu' }).click();
	await page.getByRole('menuitem', { name: 'Sign Out' }).click();
	await expect(page).toHaveURL(/\/auth\/signin/);

	await page.goto('/orgs');
	await expect(page).toHaveURL(/\/auth\/signin/);
	const { rows } = await db.query(
		`SELECT count(*)::int AS n FROM auth.session WHERE user_id = $1 AND expires_at > now()`,
		[user.id]
	);
	expect(rows[0].n).toBe(1); // the World's own API sign-in; the page's session is gone
});

test('two-factor setup verifies a code from the authenticator and shows backup codes', async ({ world, db }) => {
	const user = await world.createUser();
	const { page } = await world.signIn(user);

	await setUpTwoFactor(page, user.password);

	const { rows } = await db.query(`SELECT two_factor_enabled FROM auth."user" WHERE id = $1`, [user.id]);
	expect(rows[0].two_factor_enabled).toBe(true);
});

test('signing in with two-factor on asks for a code, refuses a wrong one, and lets the user in with the right one', async ({ world }) => {
	const user = await world.createUser();
	const { secret } = await setUpTwoFactor((await world.signIn(user)).page, user.password);

	const { page } = await world.anonymous();
	await gotoHydrated(page, '/auth/signin');
	await fillSignIn(page, user.email, user.password);

	await expect(page.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible();
	await expect(page).toHaveURL(/\/auth\/signin/);

	await page.getByRole('textbox', { name: 'Authentication code' }).fill('000000');
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page.locator('.text-error')).not.toBeEmpty();

	await page.getByRole('textbox', { name: 'Authentication code' }).fill(await nextTotp(secret));
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page).toHaveURL(/\/orgs$/);
});

test('a backup code also completes a two-factor sign-in', async ({ world }) => {
	const user = await world.createUser();
	const { backupCodes } = await setUpTwoFactor((await world.signIn(user)).page, user.password);
	expect(backupCodes.length).toBeGreaterThan(0);

	const { page } = await world.anonymous();
	await gotoHydrated(page, '/auth/signin');
	await fillSignIn(page, user.email, user.password);
	await page.getByRole('button', { name: 'Use a backup code instead' }).click();
	await page.getByRole('textbox', { name: 'Backup code' }).fill(backupCodes[0]);
	await page.getByRole('button', { name: 'Verify' }).click();

	await expect(page).toHaveURL(/\/orgs$/);
});

test('an account with a placeholder email must set a real one first', async ({ world, db }) => {
	const user = await world.createUser();
	const fake = `e2e-${suffix()}@fake.com`;
	await db.query(`UPDATE auth."user" SET email = $2 WHERE id = $1`, [user.id, fake]);
	const { page } = await world.signIn({ ...user, email: fake });

	await page.goto('/orgs');
	await expect(page).toHaveURL(/\/auth\/update-email/);
	await waitForHydration(page);
	await expect(page.getByRole('heading', { name: 'Set your email address' })).toBeVisible();

	const real = `e2e-real-${suffix()}@example.test`;
	await page.getByRole('textbox', { name: 'Email' }).fill(real);
	await page.getByRole('button', { name: 'Send verification email' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await waitForMail(real);
});
