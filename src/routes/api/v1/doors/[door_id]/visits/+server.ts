import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { recordVisit, VisitSchema } from '$lib/server/services/canvass.service';

/**
 * Records the caller's visit to a door, replacing their earlier one there,
 * and the survey answers when someone answered.
 *
 * @auth turf member
 * @body contactStatus {'no_contact'|'contacted'} - Required. The outcome
 * @body attemptNote {string} - Optional. A note about the visit
 * @body questions {Array<{ db_id: uuid, response: string }>} - Required. Answers, saved only when contacted
 * @returns 204 No Content. 400 for an invalid id or body, 401 when signed out, 403 unless the caller joined the turf, 404 when the door is in none of the caller's organizations
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const doorId = parseId(params.door_id, 'door');
	await recordVisit(userId, doorId, await parseBody(request, VisitSchema));

	return new Response(null, { status: 204 });
};
