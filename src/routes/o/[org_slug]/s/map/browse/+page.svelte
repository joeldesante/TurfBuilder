<script lang="ts">
	import { deserialize } from '$app/forms';
	import BrowsePublicLayersPage from '$pages/o/s/map/browse/BrowsePublicLayersPage.svelte';
	import type { PublicLayer } from '$pages/o/s/map/browse/BrowsePublicLayersPage.svelte';

	const { data } = $props();

	async function onAdd(layer: PublicLayer) {
		const body = new FormData();
		body.set('layerId', layer.id);

		const response = await fetch('?/add', { method: 'POST', body });
		const result = deserialize(await response.text());

		if (result.type === 'failure') {
			throw new Error(
				(result.data as { error?: string } | undefined)?.error ?? 'Failed to add the layer.'
			);
		}
		if (result.type === 'error') {
			throw new Error(result.error.message ?? 'Failed to add the layer.');
		}
	}
</script>

<BrowsePublicLayersPage layers={data.layers} {onAdd} />
