import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import {
	createListTurfs,
	CreateTurfsSchema,
	listListTurfs
} from '$lib/server/services/turfs.service';

/**
 * The list's turfs with their outlines, newest first, for the list map.
 *
 * @auth staff
 * @returns `Array<{ id, code, created_at, expires_at, author, survey_name, bounds }>`, `bounds` as GeoJSON text. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the list is in none of the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await listListTurfs(userId, parseId(params.list_id, 'list')));
};

/**
 * Cuts one turf per polygon from the list. Each turf's doors are the list's
 * locations inside its polygon, at the versions the list recorded, and each
 * gets a six-character join code.
 *
 * @auth staff
 * @permission turf.create
 * @body polygons {Array<{ geometry: GeoJSON }>} - Required, at least one
 * @body survey_id {string} - Required. The survey canvassers fill in
 * @body script_id {string|null} - Optional. The script canvassers read
 * @body expires_at {string} - Optional. ISO date; 7 days from now when missing
 * @returns 201 with `{ turfs: Array<{ id, code, list_id, survey_id, script_id, expires_at, created_at }> }`. 400 for an invalid id or body, 401 when signed out, 403 without `turf.create`, 404 when the list is in none of the caller's organizations
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const listId = parseId(params.list_id, 'list');
	const input = await parseBody(request, CreateTurfsSchema);

	return json({ turfs: await createListTurfs(userId, listId, input) }, { status: 201 });
};
