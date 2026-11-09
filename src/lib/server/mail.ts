import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { env } from '$env/dynamic/private';
import { POOL } from '$lib/server/database';
import { fillTemplate } from '$lib/shared/utils/email-template';
import { logger } from '$lib/server/logger';

interface MailSettings {
	transport: string;
	domain: string;
	applicationName: string;
	sesRegion: string;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
}

type Transport = 'direct' | 'ses' | 'smtp';

export interface EmailTemplate {
	subject: string;
	html_body: string;
}

async function loadMailSettings(): Promise<MailSettings> {
	const result = await POOL.query<{ key: string; value: string }>(
		`SELECT key, value FROM system_setting WHERE key IN (
			'mail.transport', 'mail.domain', 'application_name', 'mail.ses.region',
			'mail.smtp.host', 'mail.smtp.port', 'mail.smtp.secure'
		)`
	);
	const map = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
	return {
		transport: map['mail.transport'] ?? 'direct',
		domain: map['mail.domain'] ?? '',
		applicationName: map['application_name'] ?? '',
		sesRegion: map['mail.ses.region'] ?? '',
		smtpHost: map['mail.smtp.host'] ?? '',
		smtpPort: Number(map['mail.smtp.port'] ?? 587) || 587,
		smtpSecure: map['mail.smtp.secure'] === 'true'
	};
}

async function loadTemplate(key: string): Promise<EmailTemplate> {
	const result = await POOL.query<EmailTemplate>(
		`SELECT subject, html_body FROM email_template WHERE key = $1`,
		[key]
	);
	if (result.rowCount === 0) {
		throw new Error(`Email template not found: ${key}`);
	}
	return result.rows[0];
}

function fromAddress(settings: MailSettings): string {
	return settings.applicationName
		? `"${settings.applicationName}" <no-reply@${settings.domain}>`
		: `no-reply@${settings.domain}`;
}

async function sendDirect(
	settings: MailSettings,
	to: string,
	subject: string,
	html: string
): Promise<boolean> {
	// `direct: true` is a valid nodemailer transport option not reflected in @types/nodemailer
	const transporter = nodemailer.createTransport({ direct: true } as Parameters<
		typeof nodemailer.createTransport
	>[0]);
	await transporter.sendMail({ from: fromAddress(settings), to, subject, html });
	return true;
}

async function sendSES(
	settings: MailSettings,
	to: string,
	subject: string,
	html: string
): Promise<boolean> {
	if (!settings.sesRegion) {
		logger.warn('[mail] SES region is not configured (mail.ses.region), so the email was not sent');
		return false;
	}

	// Credentials are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars via the SDK default chain.
	const client = new SESv2Client({ region: settings.sesRegion });

	await client.send(
		new SendEmailCommand({
			FromEmailAddress: fromAddress(settings),
			Destination: { ToAddresses: [to] },
			Content: {
				Simple: {
					Subject: { Data: subject, Charset: 'UTF-8' },
					Body: { Html: { Data: html, Charset: 'UTF-8' } }
				}
			}
		})
	);
	return true;
}

async function sendSMTP(
	settings: MailSettings,
	to: string,
	subject: string,
	html: string
): Promise<boolean> {
	if (!settings.smtpHost) {
		logger.warn('[mail] SMTP host is not configured (mail.smtp.host), so the email was not sent');
		return false;
	}

	// Credentials live in the environment, never the database.
	const user = env.MAIL_SMTP_USER;
	const pass = env.MAIL_SMTP_PASSWORD;
	const transporter = nodemailer.createTransport({
		host: settings.smtpHost,
		port: settings.smtpPort,
		secure: settings.smtpSecure,
		auth: user ? { user, pass } : undefined
	});
	await transporter.sendMail({ from: fromAddress(settings), to, subject, html });
	return true;
}

function transportOf(settings: MailSettings): Transport {
	return settings.transport === 'ses' || settings.transport === 'smtp'
		? settings.transport
		: 'direct';
}

const SENDERS: Record<Transport, typeof sendDirect> = {
	direct: sendDirect,
	ses: sendSES,
	smtp: sendSMTP
};

/** Whether outgoing mail is set up well enough to try sending. */
export async function isMailConfigured(): Promise<boolean> {
	const settings = await loadMailSettings();
	if (!settings.domain) return false;
	const transport = transportOf(settings);
	if (transport === 'ses') return Boolean(settings.sesRegion);
	if (transport === 'smtp') return Boolean(settings.smtpHost);
	return true;
}

async function logEmail(
	recipient: string,
	template: string,
	subject: string | null,
	status: 'sent' | 'skipped' | 'failed',
	error: string | null = null
): Promise<void> {
	try {
		await POOL.query(
			`INSERT INTO email_log (recipient, template, subject, status, error) VALUES ($1, $2, $3, $4, $5)`,
			[recipient, template, subject, status, error]
		);
	} catch (e) {
		logger.error({ err: e }, '[mail] Could not write the email log');
	}
}

/**
 * Sends an already rendered email and records the attempt in email_log as
 * sent, skipped (mail is not configured), or failed. Rethrows a transport
 * error after logging it.
 */
export async function deliverEmail(
	to: string,
	template: string,
	subject: string,
	html: string
): Promise<'sent' | 'skipped'> {
	const settings = await loadMailSettings();
	const transport = transportOf(settings);

	// Checked once here for both transports, so one misconfiguration is one warning.
	if (!settings.domain) {
		logger.warn({ template, transport }, '[mail] mail.domain is empty, so the email was not sent');
		await logEmail(to, template, subject, 'skipped', 'Mail is not configured.');
		return 'skipped';
	}

	const send = SENDERS[transport];
	const startedAt = performance.now();

	let sent: boolean;
	try {
		sent = await send(settings, to, subject, html);
	} catch (e) {
		logger.error(
			{ err: e, template, transport, durationMs: Math.round(performance.now() - startedAt) },
			'[mail] Sending failed'
		);
		await logEmail(to, template, subject, 'failed', e instanceof Error ? e.message : String(e));
		throw e;
	}

	await logEmail(
		to,
		template,
		subject,
		sent ? 'sent' : 'skipped',
		sent ? null : 'Mail is not configured.'
	);
	if (sent) {
		// No recipient or subject: both are personal data. The email_log table has them.
		logger.info(
			{
				template,
				transport,
				htmlBytes: html.length,
				durationMs: Math.round(performance.now() - startedAt)
			},
			'[mail] Sent email'
		);
	}
	return sent ? 'sent' : 'skipped';
}

/** Fills a template's {{variables}}. Unknown variables become empty. */
export function renderTemplate(
	template: EmailTemplate,
	variables: Record<string, string>
): { subject: string; html: string } {
	return {
		subject: fillTemplate(template.subject, variables),
		html: fillTemplate(template.html_body, variables)
	};
}

export async function sendEmail(
	to: string,
	template: string,
	variables: Record<string, string>
): Promise<void> {
	let tmpl: EmailTemplate;
	try {
		tmpl = await loadTemplate(template);
	} catch (e) {
		await logEmail(to, template, null, 'failed', e instanceof Error ? e.message : String(e));
		throw e;
	}

	const { subject, html } = renderTemplate(tmpl, variables);
	await deliverEmail(to, template, subject, html);
}
