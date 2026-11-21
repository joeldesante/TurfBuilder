import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireMapLayerOrg, requireOrgPermission } from '$lib/server/list-access';
import type { CreateMapLayerInput, UpdateMapLayerInput } from '$lib/shared/schemas/map-layers';
import type { MapLayer, MapLayerSummary } from '$lib/shared/types/map-layers';

/**
 * Map layers are GeoJSON shape sets an organization draws over its maps, each
 * in one color. `position` orders them: 0 is drawn on top, larger numbers sit
 * further down.
 */

// There are no map_layer.* permission keys yet, so layers use the same staff
// check as buckets, surveys and contact schemas.
const PERMISSION = 'system.access';

/** Everything but the shapes, which can run to megabytes and are fetched one layer at a time. */
const SUMMARY_COLUMNS = 'id, name, color, label_field, position, created_at, updated_at';
const COLUMNS = `${SUMMARY_COLUMNS}, geojson`;

/** The org's map layers without their shapes, top first. 404 unless the caller is a member, 403 without staff access. */
export async function listMapLayers(userId: string, orgId: string): Promise<MapLayerSummary[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<MapLayerSummary>(
			`SELECT ${SUMMARY_COLUMNS}
			 FROM public.map_layer
			 WHERE organization_id = $1
			 ORDER BY position, created_at, id`,
			[orgId]
		);
		return result.rows;
	});
}

/**
 * The org's map layers with their shapes, top first, for the map editor, which
 * shows them all. 404 unless the caller is a member, 403 without staff access.
 */
export async function listMapLayersWithShapes(userId: string, orgId: string): Promise<MapLayer[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<MapLayer>(
			`SELECT ${COLUMNS}
			 FROM public.map_layer
			 WHERE organization_id = $1
			 ORDER BY position, created_at, id`,
			[orgId]
		);
		return result.rows;
	});
}

/**
 * Adds a layer on top of the others: it takes position 0 and every other layer
 * moves down one. 404 unless the caller is a member, 403 without staff access.
 */
export async function createMapLayer(
	userId: string,
	orgId: string,
	input: CreateMapLayerInput
): Promise<MapLayerSummary> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		await client.query(
			`UPDATE public.map_layer SET position = position + 1 WHERE organization_id = $1`,
			[orgId]
		);
		// The caller sent the shapes, so they are not sent back.
		const result = await client.query<MapLayerSummary>(
			`INSERT INTO public.map_layer (organization_id, name, color, label_field, geojson, position)
			 VALUES ($1, $2, $3, $4, $5, 0)
			 RETURNING ${SUMMARY_COLUMNS}`,
			[orgId, input.name, input.color, input.label_field, JSON.stringify(input.geojson)]
		);
		return result.rows[0];
	});
}

/** One map layer with its shapes. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function getMapLayer(userId: string, layerId: string): Promise<MapLayer> {
	const orgId = await requireMapLayerOrg(userId, layerId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<MapLayer>(
			`SELECT ${COLUMNS} FROM public.map_layer WHERE id = $1 AND organization_id = $2`,
			[layerId, orgId]
		);
		if (!result.rowCount) throw error(404, 'Map layer not found');
		return result.rows[0];
	});
}

/** Changes a layer's name, color or label. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function updateMapLayer(
	userId: string,
	layerId: string,
	input: UpdateMapLayerInput
): Promise<MapLayerSummary> {
	const orgId = await requireMapLayerOrg(userId, layerId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		// Each column keeps its value unless the input names it; label_field can be set to null.
		const result = await client.query<MapLayerSummary>(
			`UPDATE public.map_layer
			 SET name = COALESCE($3, name),
			     color = COALESCE($4, color),
			     label_field = CASE WHEN $5::boolean THEN $6 ELSE label_field END,
			     updated_at = now()
			 WHERE id = $1 AND organization_id = $2
			 RETURNING ${SUMMARY_COLUMNS}`,
			[
				layerId,
				orgId,
				input.name ?? null,
				input.color ?? null,
				input.label_field !== undefined,
				input.label_field ?? null
			]
		);
		if (!result.rowCount) throw error(404, 'Map layer not found');
		return result.rows[0];
	});
}

/** Deletes a layer. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function deleteMapLayer(userId: string, layerId: string): Promise<void> {
	const orgId = await requireMapLayerOrg(userId, layerId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	await withOrgTransaction(orgId, async (client) => {
		await client.query(`DELETE FROM public.map_layer WHERE id = $1 AND organization_id = $2`, [
			layerId,
			orgId
		]);
	});
}

/**
 * Puts the org's layers in the given order, top first. `ids` must name every
 * layer of the org exactly once. 409 when it does not, which means a layer was
 * added or deleted since the caller loaded the list.
 */
export async function reorderMapLayers(userId: string, orgId: string, ids: string[]): Promise<void> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	await withOrgTransaction(orgId, async (client) => {
		// Locked so a layer added or deleted meanwhile cannot slip past the comparison.
		const current = await client.query<{ id: string }>(
			`SELECT id FROM public.map_layer WHERE organization_id = $1 FOR UPDATE`,
			[orgId]
		);
		const known = new Set(current.rows.map((r) => r.id));
		if (
			ids.length !== known.size ||
			new Set(ids).size !== ids.length ||
			!ids.every((id) => known.has(id))
		) {
			throw error(409, 'The list of layers changed. Reload the page and try again.');
		}

		await client.query(
			`UPDATE public.map_layer ml
			 SET position = ordered.position::integer - 1
			 FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id, position)
			 WHERE ml.id = ordered.id AND ml.organization_id = $1`,
			[orgId, ids]
		);
	});
}
