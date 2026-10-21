import { error } from '@sveltejs/kit';
import { POOL, withTransaction } from '$lib/server/database';
import { deliverEmail, isMailConfigured } from '$lib/server/mail';
import { requireInfraPermission } from '$lib/server/permissions';
import { audit } from './audit.service';
import { EMAIL_TEMPLATES_BY_KEY } from '$lib/shared/registries/email-templates';
import { fillTemplate } from '$lib/shared/utils/email-template';
import type { EmailTemplateBody } from '$lib/shared/schemas/email-templates';
import type { EmailTemplateDetail, EmailTemplateSummary } from '$lib/shared/types/email-templates';

interface TemplateRow {
	key: string;
	subject: string;
	html_body: string;
	variables: string[];
	updated_at: Date;
}

function toDetail(row: TemplateRow): EmailTemplateDetail {
	const fallback = EMAIL_TEMPLATES_BY_KEY.get(row.key);
	return {
		key: row.key,
		name: fallback?.name ?? row.key,
		description: fallback?.description ?? '',
		subject: row.subject,
		htmlBody: row.html_body,
		variables: row.variables,
		customized: fallback ? fallback.subject !== row.subject || fallback.htmlBody !== row.html_body : true,
		updatedAt: row.updated_at.toISOString(),
		sample: fallback?.sample ?? Object.fromEntries(row.variables.map((name) => [name, `{{${name}}}`]))
	};
}

async function findTemplate(key: string): Promise<EmailTemplateDetail> {
	const result = await POOL.query<TemplateRow>(
		`SELECT key, subject, html_body, variables, updated_at FROM email_template WHERE key = $1`,
		[key]
	);
	if (result.rowCount === 0) throw error(404, 'Email template not found.');
	return toDetail(result.rows[0]);
}

/** Every template, for the list page. 403 without `settings.manage`. */
export async function listEmailTemplates(userId: string): Promise<EmailTemplateSummary[]> {
	await requireInfraPermission(userId, 'settings.manage');
	const result = await POOL.query<TemplateRow>(
		`SELECT key, subject, html_body, variables, updated_at FROM email_template ORDER BY key`
	);
	return result.rows.map((row) => {
		const { htmlBody: _htmlBody, sample: _sample, ...summary } = toDetail(row);
		return summary;
	});
}

/** One template with its body. 403 without `settings.manage`, 404 for an unknown key. */
export async function getEmailTemplate(userId: string, key: string): Promise<EmailTemplateDetail> {
	await requireInfraPermission(userId, 'settings.manage');
	return findTemplate(key);
}

/** Saves a template's subject and body. The variables a template offers are fixed by the code that sends it. */
export async function updateEmailTemplate(userId: string, key: string, body: EmailTemplateBody): Promise<EmailTemplateDetail> {
	await requireInfraPermission(userId, 'settings.manage');
	return withTransaction(async (client) => {
		const result = await client.query<TemplateRow>(
			`UPDATE email_template SET subject = $2, html_body = $3, updated_at = now()
			 WHERE key = $1
			 RETURNING key, subject, html_body, variables, updated_at`,
			[key, body.subject, body.htmlBody]
		);
		if (result.rowCount === 0) throw error(404, 'Email template not found.');
		await audit(userId, 'email_template.update', { type: 'email_template', id: key }, {}, client);
		return toDetail(result.rows[0]);
	});
}

/** Puts a template back to the text the app shipped with. 404 when the app has no default for it. */
export async function resetEmailTemplate(userId: string, key: string): Promise<EmailTemplateDetail> {
	await requireInfraPermission(userId, 'settings.manage');
	const fallback = EMAIL_TEMPLATES_BY_KEY.get(key);
	if (!fallback) throw error(404, 'This template has no default to go back to.');

	return withTransaction(async (client) => {
		const result = await client.query<TemplateRow>(
			`UPDATE email_template SET subject = $2, html_body = $3, updated_at = now()
			 WHERE key = $1
			 RETURNING key, subject, html_body, variables, updated_at`,
			[key, fallback.subject, fallback.htmlBody]
		);
		if (result.rowCount === 0) throw error(404, 'Email template not found.');
		await audit(userId, 'email_template.reset', { type: 'email_template', id: key }, {}, client);
		return toDetail(result.rows[0]);
	});
}

/**
 * Sends the template, filled with sample values, to the admin's own address.
 * Uses the given text when it is passed, so unsaved edits can be tried.
 * 409 when mail is not set up.
 */
export async function sendTemplateTest(
	userId: string,
	key: string,
	body: Partial<EmailTemplateBody> = {}
): Promise<{ to: string }> {
	await requireInfraPermission(userId, 'settings.manage');
	const template = await findTemplate(key);
	if (!(await isMailConfigured())) throw error(409, 'Mail is not set up. Set a sending domain in Settings first.');

	const admin = await POOL.query<{ email: string }>(`SELECT email FROM auth.user WHERE id = $1`, [userId]);
	const to = admin.rows[0]?.email;
	if (!to) throw error(404, 'Your account has no email address.');

	const subject = `[Test] ${fillTemplate(body.subject ?? template.subject, template.sample)}`;
	const html = fillTemplate(body.htmlBody ?? template.htmlBody, template.sample);
	try {
		await deliverEmail(to, key, subject, html);
	} catch (e) {
		console.error('[email-templates] Test send failed:', e);
		throw error(502, 'The mail server did not accept the email. The email log has the details.');
	}
	await audit(userId, 'email_template.test', { type: 'email_template', id: key }, { to });
	return { to };
}
