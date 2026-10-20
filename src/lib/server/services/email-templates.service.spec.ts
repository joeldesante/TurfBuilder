import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mocks = vi.hoisted(() => ({
	pool: { query: vi.fn(), connect: vi.fn() },
	requireInfraPermission: vi.fn(),
	audit: vi.fn(),
	deliverEmail: vi.fn(),
	isMailConfigured: vi.fn()
}));

vi.mock('$lib/server/database', () => ({ POOL: mocks.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: mocks.requireInfraPermission }));
vi.mock('$lib/server/mail', () => ({ deliverEmail: mocks.deliverEmail, isMailConfigured: mocks.isMailConfigured }));
vi.mock('./audit.service', () => ({ audit: mocks.audit }));

import {
	getEmailTemplate,
	listEmailTemplates,
	resetEmailTemplate,
	sendTemplateTest,
	updateEmailTemplate
} from './email-templates.service';
import { EMAIL_TEMPLATES_BY_KEY } from '$lib/shared/registries/email-templates';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const KEY = 'auth.reset_password';
const fallback = EMAIL_TEMPLATES_BY_KEY.get(KEY)!;

const row = {
	key: KEY,
	subject: fallback.subject,
	html_body: fallback.htmlBody,
	variables: fallback.variables,
	updated_at: new Date('2026-10-01T00:00:00Z')
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	mocks.isMailConfigured.mockResolvedValue(true);
	mocks.pool.query.mockImplementation(async (sql: string) => {
		if (sql.includes('FROM auth.user')) return { rowCount: 1, rows: [{ email: 'grace@example.com' }] };
		return { rowCount: 1, rows: [row] };
	});
});

describe('access', () => {
	it('needs settings.manage for every read and write', async () => {
		mocks.requireInfraPermission.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));

		for (const call of [
			() => listEmailTemplates(ADMIN),
			() => getEmailTemplate(ADMIN, KEY),
			() => updateEmailTemplate(ADMIN, KEY, { subject: 's', htmlBody: 'b' }),
			() => resetEmailTemplate(ADMIN, KEY),
			() => sendTemplateTest(ADMIN, KEY)
		]) {
			await expect(call()).rejects.toMatchObject({ status: 403 });
		}
		expect(mocks.requireInfraPermission).toHaveBeenCalledWith(ADMIN, 'settings.manage');
		expect(mocks.pool.query).not.toHaveBeenCalled();
	});
});

describe('reading', () => {
	it('flags a template as customized only when its text differs from the default', async () => {
		expect((await getEmailTemplate(ADMIN, KEY)).customized).toBe(false);

		mocks.pool.query.mockResolvedValue({ rowCount: 1, rows: [{ ...row, subject: 'Changed' }] });
		expect((await getEmailTemplate(ADMIN, KEY)).customized).toBe(true);
	});

	it('answers 404 for a missing template', async () => {
		mocks.pool.query.mockResolvedValue({ rowCount: 0, rows: [] });

		await expect(getEmailTemplate(ADMIN, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('lists templates without their bodies', async () => {
		const [first] = await listEmailTemplates(ADMIN);

		expect(first).toMatchObject({ key: KEY, name: fallback.name });
		expect(first).not.toHaveProperty('htmlBody');
	});
});

describe('updateEmailTemplate', () => {
	it('saves the text and records it without the text', async () => {
		await updateEmailTemplate(ADMIN, KEY, { subject: 'New', htmlBody: '<p>x</p>' });

		expect(mocks.pool.query.mock.calls[0][1]).toEqual([KEY, 'New', '<p>x</p>']);
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'email_template.update', { type: 'email_template', id: KEY });
	});
});

describe('resetEmailTemplate', () => {
	it('restores the default text', async () => {
		await resetEmailTemplate(ADMIN, KEY);

		expect(mocks.pool.query.mock.calls[0][1]).toEqual([KEY, fallback.subject, fallback.htmlBody]);
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'email_template.reset', { type: 'email_template', id: KEY });
	});

	it('answers 404 for a template the app has no default for', async () => {
		await expect(resetEmailTemplate(ADMIN, 'custom.thing')).rejects.toMatchObject({ status: 404 });
	});
});

describe('sendTemplateTest', () => {
	it('sends the filled template to the admin and tags the subject', async () => {
		const result = await sendTemplateTest(ADMIN, KEY, { subject: 'Try {{username}}' });

		expect(result).toEqual({ to: 'grace@example.com' });
		expect(mocks.deliverEmail).toHaveBeenCalledWith('grace@example.com', KEY, '[Test] Try Ada', expect.stringContaining('Reset password'));
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'email_template.test', { type: 'email_template', id: KEY }, { to: 'grace@example.com' });
	});

	it('answers 409 when mail is not set up and sends nothing', async () => {
		mocks.isMailConfigured.mockResolvedValue(false);

		await expect(sendTemplateTest(ADMIN, KEY)).rejects.toMatchObject({ status: 409 });
		expect(mocks.deliverEmail).not.toHaveBeenCalled();
	});

	it('answers 502 with a safe message when the transport fails', async () => {
		mocks.deliverEmail.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:25'));
		const failure = await sendTemplateTest(ADMIN, KEY).catch((e) => e);

		expect(failure.status).toBe(502);
		expect(JSON.stringify(failure.body)).not.toContain('10.0.0.5');
	});
});
