<script lang="ts">
	import UniverseDataLocationsImportPage from '$pages/universe/data/locations/import/UniverseDataLocationsImportPage.svelte';
	import type { ImportSource } from '$pages/universe/data/locations/import/UniverseDataLocationsImportPage.svelte';

	const { data } = $props();

	const validSources: ImportSource[] = ['csv', 'google-sheets'];
	const source = validSources.includes(data.source as ImportSource)
		? (data.source as ImportSource)
		: 'csv';
</script>

<UniverseDataLocationsImportPage orgSlug={data.orgSlug} {source} />
