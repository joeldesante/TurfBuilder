<script lang="ts">
	import { getDuckDB } from '$lib/client/duckdb.js';
	import OvertureImportPage from '$pages/o/s/universe/data/locations/import/OvertureImportPage.svelte';
	import type {
		ImportProgress,
		ImportResult
	} from '$pages/o/s/universe/data/locations/import/OvertureImportPage.svelte';

	const { data } = $props();

	function getBoundingBox(polygon: GeoJSON.Polygon) {
		const coords = polygon.coordinates.flat();
		return {
			minX: Math.min(...coords.map((c) => c[0])),
			maxX: Math.max(...coords.map((c) => c[0])),
			minY: Math.min(...coords.map((c) => c[1])),
			maxY: Math.max(...coords.map((c) => c[1]))
		};
	}

	async function handleImport(polygon: GeoJSON.Polygon): Promise<void> {
		console.log('Import');
		const duckdb = await getDuckDB();
		const conn = await duckdb.connect();

		try {
			// Install extensions (run once per session)
			await conn.query(`INSTALL spatial`);
			await conn.query(`LOAD spatial`);
			await conn.query(`INSTALL httpfs`);
			await conn.query(`LOAD httpfs`);

			// Set S3 region (Overture is in us-west-2)
			await conn.query(`SET s3_region='us-west-2'`);
			await conn.query(`SET allow_asterisks_in_http_paths = true;`);

			const bbox = getBoundingBox(polygon); // derive from your GeoJSON polygon
			const result = await conn.query(`
				SELECT
					id,
					names.primary AS name,
					categories.primary AS category,
					geometry
				FROM read_parquet(
					'https://overturemaps-us-west-2.s3.amazonaws.com/release/2026-05-20.0/theme=places/type=place/*.parquet')
				WHERE
					bbox.xmin BETWEEN ${bbox.minX} AND ${bbox.maxX}
					AND bbox.ymin BETWEEN ${bbox.minY} AND ${bbox.maxY}
		`);

			console.log(result);
		} finally {
			await conn.close();
		}
	}
</script>

<OvertureImportPage orgSlug={data.orgSlug} onImport={handleImport} />
