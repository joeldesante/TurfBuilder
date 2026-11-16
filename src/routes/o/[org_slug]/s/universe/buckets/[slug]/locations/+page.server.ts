import { error } from '@sveltejs/kit';
import { getBucketMapOverview, listBucketLocations } from '$lib/server/services/buckets.service';
import { listMapLayers } from '$lib/server/services/map-layers.service';
import type { MapLayerSummary } from '$lib/shared/types/map-layers';
import type { BucketMapOverview } from '$lib/shared/types/bucket-map';
import { PAGE_SIZE, requestedPage } from '$lib/shared/utils/pagination';

export interface LocationRow {
	id: string;
	name: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
}

/**
 * The bucket's locations as a list, one page at a time, or with `?view=map`
 * on a map. The map loads its points per viewport from the API, so the load
 * only gives it where to open and how many locations there are.
 */
export async function load({ parent, locals, url }) {
	const { bucket } = await parent();

	if (!bucket.filters) throw error(422, bucket.problem);

	const view: 'list' | 'map' = url.searchParams.get('view') === 'map' ? 'map' : 'list';
	const empty = {
		view,
		locations: [] as LocationRow[],
		map: { total: 0, bounds: null } as BucketMapOverview,
		mapLayers: [] as MapLayerSummary[],
		totalCount: 0,
		page: 1,
		pageSize: PAGE_SIZE
	};

	if (!bucket.filters.locations) return { ...empty, enabled: false };

	if (view === 'map') {
		// Layers are only listed (names and colors); the map fetches a layer's shapes when it is turned on.
		const [map, mapLayers] = await Promise.all([
			getBucketMapOverview(locals.user!.id, bucket.id),
			listMapLayers(locals.user!.id, locals.organization!.id)
		]);
		return { ...empty, enabled: true, map, mapLayers };
	}

	const result = await listBucketLocations(locals.user!.id, bucket.id, requestedPage(url));
	return {
		...empty,
		enabled: true,
		locations: result.items as unknown as LocationRow[],
		totalCount: result.totalCount,
		page: result.page,
		pageSize: result.pageSize
	};
}
