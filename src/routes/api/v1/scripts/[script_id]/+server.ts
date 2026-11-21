import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { getScript, updateScript } from '$lib/server/services/scripts.service';
import { updateScriptSchema } from '$lib/shared/schemas/scripts';

/**
 * One script with its text.
 *
 * @auth staff
 * @returns `{ id, bucket_id, name, updated_at, contents }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const scriptId = parseId(params.script_id, 'script');

	return json(await getScript(userId, scriptId));
};

/**
 * Updates the given fields of a script and leaves the rest as they are.
 *
 * @auth staff
 * @body name {string} - Optional. Display name, 1 to 255 characters
 * @body contents {string} - Optional. The script text
 * @returns The script as `GET` returns it. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const scriptId = parseId(params.script_id, 'script');
	const body = await parseBody(request, updateScriptSchema);

	return json(await updateScript(userId, scriptId, body));
};
