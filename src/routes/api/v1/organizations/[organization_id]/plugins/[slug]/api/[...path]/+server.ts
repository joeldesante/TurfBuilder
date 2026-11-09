import type { RequestEvent, RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { runPluginApi } from '$lib/server/services/plugin-installations.service';

/**
 * Hands the request to the plugin's `METHOD:path` API handler, e.g. `GET /status`
 * to its `GET:status` handler.
 *
 * @auth staff (any organization role)
 * @returns Whatever the handler answers. 400 for an invalid id, 401 when signed out, 403 without a staff role, 404 when the plugin is not active in the organization or has no such handler
 */
function dispatch(method: string): RequestHandler {
	return async (event: RequestEvent) => {
		const userId = requireUser(event.locals);
		const orgId = parseId(event.params.organization_id, 'organization');
		return runPluginApi(userId, orgId, event.params.slug, method, event.params.path, event);
	};
}

export const GET = dispatch('GET');
export const POST = dispatch('POST');
export const PUT = dispatch('PUT');
export const PATCH = dispatch('PATCH');
export const DELETE = dispatch('DELETE');
