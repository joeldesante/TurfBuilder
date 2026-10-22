import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { parseBody, parseTemplateKey } from '$lib/server/request';
import { emailTemplateBodySchema } from '$lib/shared/schemas/email-templates';
import { getEmailTemplate, updateEmailTemplate } from '$lib/server/services/email-templates.service';

/**
 * One email template with its subject, body, variables, and sample values.
 *
 * @auth infra settings.manage
 * @returns `EmailTemplateDetail`. 400 for a malformed key, 403 without settings.manage, 404 for an unknown template
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await getEmailTemplate(userId, parseTemplateKey(params.template_key)));
};

/**
 * Replaces a template's subject and body.
 *
 * @auth infra settings.manage
 * @body subject {string} - The subject line, with optional {{variables}}
 * @body htmlBody {string} - The HTML body, with optional {{variables}}
 * @returns the saved `EmailTemplateDetail`. 400 for an invalid body, 403 without settings.manage, 404 for an unknown template
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const key = parseTemplateKey(params.template_key);
	return json(await updateEmailTemplate(userId, key, await parseBody(request, emailTemplateBodySchema)));
};
