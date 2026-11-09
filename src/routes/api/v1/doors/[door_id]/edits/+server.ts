import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { LocationEditProposalSchema } from '$lib/schemas/location';
import { proposeLocationEdit } from '$lib/server/services/canvass.service';

/**
 * Proposes a correction to a door whose record is wrong. Staff review it
 * before it changes the location; photos travel with it as evidence.
 *
 * @auth turf member, while the turf is open
 * @body Any subset of the location fields, plus `note` {string}; latitude and longitude together or not at all
 * @returns 201 with `{ id }`. 400 for an invalid id, an invalid body, or one with nothing in it, 401 when signed out, 403 when the turf is closed or the caller is not on it, 404 when the door is in none of the caller's organizations, 422 for a pin outside the turf, 429 with 25 corrections awaiting review
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const doorId = parseId(params.door_id, 'door');
	const proposal = await parseBody(request, LocationEditProposalSchema);

	return json(await proposeLocationEdit(userId, doorId, proposal), { status: 201 });
};
