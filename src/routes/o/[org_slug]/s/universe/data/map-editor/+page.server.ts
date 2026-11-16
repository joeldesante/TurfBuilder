import { error } from '@sveltejs/kit';
import { listMapLayersWithShapes } from '$lib/server/services/map-layers.service';

/**
 * The organization's saved map layers, top first. The page breaks out of the
 * org layout (`+page@.svelte`), so the organization is returned here too.
 */
export async function load({ locals }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	const { id, slug } = locals.organization;
	return { organization: { id, slug }, layers: await listMapLayersWithShapes(locals.user.id, id) };
}
