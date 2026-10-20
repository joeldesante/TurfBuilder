import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { stopImpersonation } from '$lib/server/services/impersonation.service';

/**
 * Ends the current impersonation and restores the admin's own session.
 *
 * @auth the impersonating session
 * @returns `{ userId }` of the user who was impersonated. 401 when signed out, 409 when not impersonating
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
	requireUser(locals);
	return json(await stopImpersonation(locals, request.headers));
};
