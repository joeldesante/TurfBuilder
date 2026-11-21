import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { reorderMapLayers } from '$lib/server/services/map-layers.service';
import { mapLayerOrderSchema } from '$lib/shared/schemas/map-layers';

/**
 * Sets the order of the organization's map layers, top first.
 *
 * @auth staff
 * @body ids {string[]} - Every map layer id of the organization exactly once, top first
 * @returns 204. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when the caller is not a member, 409 when a layer was added or deleted since the caller loaded the list
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { ids } = await parseBody(request, mapLayerOrderSchema);

	await reorderMapLayers(userId, orgId, ids);
	return new Response(null, { status: 204 });
};
