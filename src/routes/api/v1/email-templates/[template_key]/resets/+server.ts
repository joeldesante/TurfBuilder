import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { parseTemplateKey } from '$lib/server/request';
import { resetEmailTemplate } from '$lib/server/services/email-templates.service';

/**
 * Puts the template back to the text the app shipped with.
 *
 * @auth infra settings.manage
 * @returns the restored `EmailTemplateDetail`. 400 for a malformed key, 403 without settings.manage, 404 for an unknown template or one with no default
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await resetEmailTemplate(userId, parseTemplateKey(params.template_key)));
};
