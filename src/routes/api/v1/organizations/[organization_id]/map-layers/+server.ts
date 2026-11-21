import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { createMapLayer, listMapLayers } from '$lib/server/services/map-layers.service';
import { createMapLayerSchema } from '$lib/shared/schemas/map-layers';

/**
 * The organization's map layers, top first, without their shapes: fetch one layer's GeoJSON from `GET /api/v1/map-layers/{map_layer_id}` when it is shown.
 *
 * @auth staff
 * @returns `Array<{ id, name, color, label_field, position, created_at, updated_at }>`. `position` 0 is drawn on top. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listMapLayers(userId, orgId));
};

/**
 * Adds a map layer on top of the others.
 *
 * @auth staff
 * @body name {string} - Display name
 * @body color {string} - Hex color, such as `#2f6fed`
 * @body label_field {string|null} - Optional. The feature property drawn as each shape's label
 * @body geojson {object} - A GeoJSON FeatureCollection, Feature, or geometry
 * @returns 201 with the layer, without its shapes. 400 for an invalid body, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const body = await parseBody(request, createMapLayerSchema);

	return json(await createMapLayer(userId, orgId, body), { status: 201 });
};
