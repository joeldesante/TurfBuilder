import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { waitForMail } from './fixtures/mail';
import { suffix } from './fixtures/world';

// Tests that change instance-wide settings or templates. They run in their own
// project after every other app test (playwright.config.ts), one at a time, so
// no other test sees the instance in a changed state.

test.describe.configure({ mode: 'serial' });

const ADMIN_EMAIL = 'test@example.com';

async function setCreation(db: import('pg').Client, allowed: boolean) {
	await db.query(
		`UPDATE system_setting SET value = $1 WHERE key = 'organizations.allow_creation'`,
		[String(allowed)]
	);
}

test.afterEach(async ({ db }) => setCreation(db, true));

test('is closed when an admin turns creation off: no button, the page redirects, the API refuses', async ({
	world,
	db
}) => {
	const org = await world.createOrg();
	const { page, request } = await world.as(org, 'volunteer');
	await setCreation(db, false);

	await gotoHydrated(page, '/orgs');
	await expect(page.getByRole('link', { name: /Start a New Movement/ })).toHaveCount(0);

	await page.goto('/orgs/create');
	await expect(page).toHaveURL(/\/orgs$/);

	const res = await request.post('/api/v1/organizations', {
		data: { name: 'Nope', slug: `nope-${suffix()}` }
	});
	expect(res.status()).toBe(403);
});

test('turning organization creation off from settings closes the create page', async ({
	world,
	db
}) => {
	const { page } = await world.admin();
	const user = await world.signIn(await world.createUser());
	try {
		const res = await page.request.patch('/api/v1/system-settings', {
			data: { 'organizations.allow_creation': 'false' }
		});
		expect(res.ok()).toBe(true);
		await user.page.goto('/orgs/create');
		await expect(user.page).toHaveURL(/\/orgs$/);
	} finally {
		await db.query(
			`UPDATE system_setting SET value = 'true' WHERE key = 'organizations.allow_creation'`
		);
	}
});

test.describe('email templates', () => {
	// Templates are instance-wide, so these change and restore one at a time.
	test.describe.configure({ mode: 'serial' });

	test('editing a template, sending a test of it, and resetting it to the default', async ({
		world,
		db
	}) => {
		const { page } = await world.admin();

		await gotoHydrated(page, '/infra/settings/email/templates');
		await page.getByRole('link').filter({ hasText: /reset/i }).first().click();
		await expect(page).toHaveURL(/\/infra\/settings\/email\/templates\/[a-z_.]+$/);
		const key = decodeURIComponent(page.url().split('/').pop()!);
		const subject = page.getByLabel('Subject');
		const original = await subject.inputValue();

		await subject.fill('E2E edited subject');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByText('Edited from the default')).toBeVisible();
		const { rows } = await db.query(`SELECT subject FROM email_template WHERE key = $1`, [key]);
		expect(rows[0].subject).toBe('E2E edited subject');

		await page.getByRole('button', { name: 'Send test to me' }).click();
		await expect
			.poll(async () => (await waitForMail(ADMIN_EMAIL)).subject)
			.toContain('E2E edited subject');

		await page.getByRole('button', { name: 'Reset to default' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
		await expect(subject).toHaveValue(original);
		await expect(page.getByText('Edited from the default')).toHaveCount(0);
	});

	test('the email log lists what was sent', async ({ world }) => {
		const user = await world.createUser(); // signing up sends a verification email
		const { page } = await world.admin();

		await gotoHydrated(page, `/infra/settings/email/log?q=${encodeURIComponent(user.email)}`);
		await expect(page.getByText(user.email).first()).toBeVisible();
	});
});
