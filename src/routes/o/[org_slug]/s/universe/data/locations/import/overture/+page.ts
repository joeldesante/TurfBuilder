import type { MapLayer } from '$components/data-display/layered-map/LayeredMap.svelte';

export function load({ fetch, params, data }) {
	return {
		...data,
		layers: fetch(`/o/${params.org_slug}/s/api/map/layers`).then(
			async (response): Promise<MapLayer[]> => {
				if (!response.ok) {
					throw new Error('Failed to load map layers.');
				}
				const body = (await response.json()) as { layers: MapLayer[] };
				return body.layers;
			}
		)
	};
}
