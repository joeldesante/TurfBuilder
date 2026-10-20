import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { parseBody, parseTemplateKey } from '$lib/server/request';
import { testSendSchema } from '$lib/shared/schemas/email-templates';
import { sendTemplateTest } from '$lib/server/services/email-templates.service';

/**
 * Emails the template, filled with sample values, to the signed-in admin. Unsaved text can be sent by passing it.
 *
 * @auth infra settings.manage
 * @body subject {string} - Optional subject to send instead of the saved one
 * @body htmlBody {string} - Optional body to send instead of the saved one
 * @returns `{ to }`. 400 for an invalid body, 403 without settings.manage, 404 for an unknown template, 409 when mail is not set up, 502 when the mail server refuses it
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const key = parseTemplateKey(params.template_key);
	return json(await sendTemplateTest(userId, key, await parseBody(request, testSendSchema)));
};
