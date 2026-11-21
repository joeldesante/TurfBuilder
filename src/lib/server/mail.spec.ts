import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	settings: {} as Record<string, string>,
	createTransport: vi.fn(),
	sendMail: vi.fn(async () => ({})),
	sesSend: vi.fn(async () => ({})),
	logInserts: [] as unknown[][],
	env: {} as Record<string, string | undefined>
}));

vi.mock('$env/dynamic/private', () => ({ env: m.env }));
vi.mock('$lib/server/database', () => ({
	POOL: {
		query: vi.fn(async (sql: string, values?: unknown[]) => {
			if (sql.includes('FROM system_setting')) {
				return { rows: Object.entries(m.settings).map(([key, value]) => ({ key, value })) };
			}
			if (sql.includes('INSERT INTO email_log')) m.logInserts.push(values ?? []);
			return { rows: [] };
		})
	}
}));
vi.mock('nodemailer', () => ({
	default: {
		createTransport: (opts: unknown) => {
			m.createTransport(opts);
			return { sendMail: m.sendMail };
		}
	}
}));
// A function expression, not an arrow: the client is constructed with `new`.
vi.mock('@aws-sdk/client-sesv2', () => ({
	SESv2Client: vi.fn(function () {
		return { send: m.sesSend };
	}),
	SendEmailCommand: vi.fn(function (input: unknown) {
		return input;
	})
}));

import { deliverEmail, isMailConfigured } from './mail';

beforeEach(() => {
	vi.clearAllMocks();
	m.logInserts.length = 0;
	for (const key of Object.keys(m.env)) delete m.env[key];
	m.settings = { 'mail.domain': 'mail.example.org', application_name: 'TurfBuilder' };
});

describe('SMTP transport', () => {
	beforeEach(() => {
		m.settings['mail.transport'] = 'smtp';
		m.settings['mail.smtp.host'] = 'mailpit';
		m.settings['mail.smtp.port'] = '1025';
		m.settings['mail.smtp.secure'] = 'false';
	});

	it('relays through the configured server and logs the send', async () => {
		expect(await deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>')).toBe('sent');

		expect(m.createTransport).toHaveBeenCalledWith({
			host: 'mailpit',
			port: 1025,
			secure: false,
			auth: undefined
		});
		expect(m.sendMail).toHaveBeenCalledWith({
			from: '"TurfBuilder" <no-reply@mail.example.org>',
			to: 'a@x.org',
			subject: 'Hi',
			html: '<p>Hi</p>'
		});
		expect(m.logInserts[0]).toEqual(['a@x.org', 'test', 'Hi', 'sent', null]);
	});

	it('signs in with the credentials from the environment', async () => {
		m.env.MAIL_SMTP_USER = 'relay';
		m.env.MAIL_SMTP_PASSWORD = 'secret';
		m.settings['mail.smtp.secure'] = 'true';
		m.settings['mail.smtp.port'] = '465';

		await deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>');

		expect(m.createTransport).toHaveBeenCalledWith({
			host: 'mailpit',
			port: 465,
			secure: true,
			auth: { user: 'relay', pass: 'secret' }
		});
	});

	it('skips the send without a host, and counts as not configured', async () => {
		m.settings['mail.smtp.host'] = '';

		expect(await deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>')).toBe('skipped');
		expect(m.sendMail).not.toHaveBeenCalled();
		expect(await isMailConfigured()).toBe(false);
	});

	it('logs a failed send and rethrows', async () => {
		m.sendMail.mockRejectedValueOnce(new Error('connection refused'));

		await expect(deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>')).rejects.toThrow(
			'connection refused'
		);
		expect(m.logInserts[0]).toEqual(['a@x.org', 'test', 'Hi', 'failed', 'connection refused']);
	});
});

describe('the other transports', () => {
	it('sends directly by default', async () => {
		await deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>');

		expect(m.createTransport).toHaveBeenCalledWith({ direct: true });
	});

	it('uses SES when chosen, and needs a region to count as configured', async () => {
		m.settings['mail.transport'] = 'ses';
		expect(await isMailConfigured()).toBe(false);

		m.settings['mail.ses.region'] = 'us-east-1';
		expect(await isMailConfigured()).toBe(true);
		await deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>');
		expect(m.sesSend).toHaveBeenCalledTimes(1);
	});

	it('skips everything without a sending domain', async () => {
		m.settings['mail.domain'] = '';

		expect(await deliverEmail('a@x.org', 'test', 'Hi', '<p>Hi</p>')).toBe('skipped');
		expect(await isMailConfigured()).toBe(false);
	});
});
