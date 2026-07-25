import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { POOL } from '$lib/server/database';
import { logger } from '$lib/server/logger';

interface MailSettings {
	transport: string;
	domain: string;
	applicationName: string;
	sesRegion: string;
}

interface EmailTemplate {
	subject: string;
	html_body: string;
}

async function loadMailSettings(): Promise<MailSettings> {
	const result = await POOL.query<{ key: string; value: string }>(
		`SELECT key, value FROM system_setting WHERE key IN (
			'mail.transport', 'mail.domain', 'application_name', 'mail.ses.region'
		)`
	);
	const map = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
	return {
		transport: map['mail.transport'] ?? 'direct',
		domain: map['mail.domain'] ?? '',
		applicationName: map['application_name'] ?? '',
		sesRegion: map['mail.ses.region'] ?? ''
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

function interpolate(text: string, variables: Record<string, string>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
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
	if (!settings.domain) {
		logger.warn('No mail domain configured (mail.domain is empty). Emails will not be sent.');
		return false;
	}
	// `direct: true` is a valid nodemailer transport option not reflected in @types/nodemailer
	const transporter = nodemailer.createTransport(
		{ direct: true } as Parameters<typeof nodemailer.createTransport>[0]
	);
	await transporter.sendMail({ from: fromAddress(settings), to, subject, html });
	return true;
}

async function sendSES(
	settings: MailSettings,
	to: string,
	subject: string,
	html: string
): Promise<boolean> {
	if (!settings.domain) {
		logger.warn('No mail domain configured (mail.domain is empty). Emails will not be sent.');
		return false;
	}
	if (!settings.sesRegion) {
		logger.warn('SES region not configured (mail.ses.region). Emails will not be sent.');
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

export async function sendEmail(
	to: string,
	template: string,
	variables: Record<string, string>
): Promise<void> {
	const [settings, tmpl] = await Promise.all([loadMailSettings(), loadTemplate(template)]);

	const subject = interpolate(tmpl.subject, variables);
	const html = interpolate(tmpl.html_body, variables);

	const send = settings.transport === 'ses' ? sendSES : sendDirect;
	const sent = await send(settings, to, subject, html);

	if (sent) {
		logger.info({ template, to }, `Sent "${subject}"`);
	}
}
