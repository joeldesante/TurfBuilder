import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { sendTestMail } from '$lib/server/services/system-tests.service';

/**
 * Sends a short test email to the signed-in admin, to prove outgoing mail works.
 *
 * @auth infra settings.manage
 * @returns `{ to }`. 403 without settings.manage, 409 when mail is not set up, 502 when the mail server refuses it
 */
export const POST: RequestHandler = async ({ locals }) => {
	return json(await sendTestMail(requireUser(locals)));
};
