import { test, expect } from './fixtures';
import { gotoHydrated } from './helpers';
import { waitForMail } from './fixtures/mail';

// Infra settings, mail, email templates, system health, and the audit log.

const ADMIN_EMAIL = 'test@example.com';

test('the storage test reaches object storage', async ({ world }) => {
	const { page } = await world.admin();

	await gotoHydrated(page, '/infra/settings');
	await page.getByRole('button', { name: 'Test connection' }).click();
	await expect(page.getByText(/connected|works|success|reached/i).first()).toBeVisible();
});

test('the mail test sends the admin an email', async ({ world, db }) => {
	const { page } = await world.admin();
	await db.query(`UPDATE auth."user" SET email_verified = true WHERE email = $1`, [ADMIN_EMAIL]);
	const before = Date.now();

	await gotoHydrated(page, '/infra/settings');
	await page.getByRole('button', { name: 'Send a test email to me' }).click();

	const mail = await waitForMail(ADMIN_EMAIL);
	expect(mail.subject.length).toBeGreaterThan(0);
	const { rows } = await db.query(
		`SELECT status FROM email_log WHERE recipient = $1 AND created_at > to_timestamp($2 / 1000.0) ORDER BY created_at DESC LIMIT 1`,
		[ADMIN_EMAIL, before]
	);
	expect(rows[0]?.status).toBe('sent');
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

test('system health reports the database, storage, and migrations', async ({ world }) => {
	const { page } = await world.admin();

	await gotoHydrated(page, '/infra/system');
	await expect(page.getByText(/database/i).first()).toBeVisible();
	await expect(page.getByText(/migration/i).first()).toBeVisible();
	await expect(page.getByText(/storage/i).first()).toBeVisible();
});

test('the audit log lists infra changes and opens their target', async ({ world }) => {
	const org = await world.createOrg();
	const { page, request } = await world.admin();
	await request.put(`/api/v1/organizations/${org.id}/suspension`, {
		data: { reason: 'Audit check' }
	});
	await request.delete(`/api/v1/organizations/${org.id}/suspension`);

	await gotoHydrated(page, '/infra/audit');
	await expect(page.getByText(org.name).first()).toBeVisible();
	await expect(page.getByText(/suspend/i).first()).toBeVisible();
});

test('the metrics page opens with its charts and range', async ({ world }) => {
	const { page } = await world.admin();

	await gotoHydrated(page, '/infra/metrics');
	await expect(page.getByRole('heading').first()).toBeVisible();
	const res = await page.goto('/infra/metrics?range=7d');
	expect(res?.status()).toBe(200);
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

test('an infra admin with only some permissions sees only what they allow', async ({
	world,
	db
}) => {
	const user = await world.createUser();
	const { rows } = await db.query<{ id: string }>(
		`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
		 VALUES ($1, 300, 'infrastructure', NULL, false) RETURNING id`,
		[`E2E auditor ${user.id.slice(0, 6)}`]
	);
	await db.query(
		`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
		 SELECT $1, id, true FROM registered_permission WHERE scope = 'infrastructure' AND key IN ('access', 'audit.read')`,
		[rows[0].id]
	);
	await db.query(`INSERT INTO user_role_membership (user_id, role_id) VALUES ($1, $2)`, [
		user.id,
		rows[0].id
	]);
	const auditor = await world.signIn(user);

	expect((await auditor.page.goto('/infra'))?.status()).toBe(200);
	expect((await auditor.page.goto('/infra/audit'))?.status()).toBe(200);
	expect(
		(
			await auditor.request.patch('/api/v1/system-settings', { data: { application_name: 'x' } })
		).status()
	).toBe(403);
	expect((await auditor.request.post(`/api/v1/users/${user.id}/impersonations`)).status()).toBe(
		403
	);
});
