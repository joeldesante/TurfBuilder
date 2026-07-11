<script lang="ts">
	import { union } from '@turf/union';
	import OvertureImportPage from '$pages/o/s/universe/data/locations/import/OvertureImportPage.svelte';
	import { redirect } from '@sveltejs/kit';
	import { goto } from '$app/navigation';

	const { data } = $props();

	// TODO: Call the Overture import microservice with the selected geometries.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, require-yield
	function handleImport(features: GeoJSON.Feature[]) {
		// 1. Union all the geometries
		const joinedFeatures = union({
			type: 'FeatureCollection',
			features: features as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[]
		});

		if (joinedFeatures == null) {
			return;
		}

		// 2. Send API request to overture microservice
		console.log(joinedFeatures.geometry.coordinates, 'SENT OFF TO OVERTURE');

		// 3. Register job in the db, then redirect to the job page
		goto('./overture/jobs');
	}
</script>

<OvertureImportPage orgSlug={data.orgSlug} layers={data.layers} onImport={handleImport} />
