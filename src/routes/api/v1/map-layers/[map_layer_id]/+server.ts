import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { deleteMapLayer, getMapLayer, updateMapLayer } from '$lib/server/services/map-layers.service';
import { updateMapLayerSchema } from '$lib/shared/schemas/map-layers';

/**
 * One map layer with its shapes. Maps fetch this when a layer is turned on, since the list leaves the shapes out.
 *
 * @auth staff
 * @returns `{ id, name, color, label_field, position, geojson, created_at, updated_at }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await getMapLayer(userId, parseId(params.map_layer_id, 'map layer')));
};

/**
 * Changes how a map layer is drawn. Its shapes cannot be changed; add a new layer instead.
 *
 * @auth staff
 * @body name {string} - Optional. Display name
 * @body color {string} - Optional. Hex color, such as `#2f6fed`
 * @body label_field {string|null} - Optional. The feature property drawn as each shape's label; null for none
 * @returns The layer, without its shapes. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const layerId = parseId(params.map_layer_id, 'map layer');
	const body = await parseBody(request, updateMapLayerSchema);

	return json(await updateMapLayer(userId, layerId, body));
};

/**
 * Deletes a map layer.
 *
 * @auth staff
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await deleteMapLayer(userId, parseId(params.map_layer_id, 'map layer'));

	return new Response(null, { status: 204 });
};
