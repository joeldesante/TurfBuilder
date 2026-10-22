import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { listEmailTemplates } from '$lib/server/services/email-templates.service';

/**
 * Every email template the app sends, without bodies.
 *
 * @auth infra settings.manage
 * @returns `EmailTemplateSummary[]`. 401 when signed out, 403 without settings.manage
 */
export const GET: RequestHandler = async ({ locals }) => {
	return json(await listEmailTemplates(requireUser(locals)));
};
