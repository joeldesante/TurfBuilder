<script lang="ts">
	import OvertureImportPage from '$pages/o/s/universe/data/locations/import/OvertureImportPage.svelte';
	import type { ImportProgress } from '$pages/o/s/universe/data/locations/import/OvertureImportPage.svelte';

	const { data } = $props();

	// TODO: Call the Overture import microservice with the selected geometries.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, require-yield
	async function* handleImport(geometries: GeoJSON.Geometry[]): AsyncGenerator<ImportProgress> {}
</script>

<OvertureImportPage orgSlug={data.orgSlug} layers={data.layers} onImport={handleImport} />
