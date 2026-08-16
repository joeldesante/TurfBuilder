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

	const BATCH_SIZE = 500;

	interface OvertureRecord {
		name?: string;
		longitude: number;
		latitude: number;
	}

	async function* handleImport(polygon: GeoJSON.Polygon): AsyncGenerator<ImportProgress> {
		yield { stage: 'querying' };

		const duckdb = await getDuckDB();
		const conn = await duckdb.connect();

		let records: OvertureRecord[];
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
					names.primary AS name,
					ST_X(geometry) AS longitude,
					ST_Y(geometry) AS latitude
				FROM read_parquet(
					'https://overturemaps-us-west-2.s3.amazonaws.com/release/2026-05-20.0/theme=places/type=place/*.parquet')
				WHERE
					bbox.xmin BETWEEN ${bbox.minX} AND ${bbox.maxX}
					AND bbox.ymin BETWEEN ${bbox.minY} AND ${bbox.maxY}
		`);

			records = result.toArray().map((row: any) => ({
				name: row.name ?? undefined,
				longitude: row.longitude,
				latitude: row.latitude
			}));
		} finally {
			await conn.close();
		}

		const total = Math.ceil(records.length / BATCH_SIZE) || 1;
		const aggregate: ImportResult = { imported: 0, skipped: 0, errors: [] };

		for (let i = 0; i < records.length; i += BATCH_SIZE) {
			const batchNum = i / BATCH_SIZE + 1;
			yield { stage: 'uploading', batch: batchNum, total };

			const chunk = records.slice(i, i + BATCH_SIZE);
			const res = await fetch(`/o/${data.orgSlug}/s/api/universe/locations/import/overture`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ records: chunk })
			});
			if (!res.ok) {
				aggregate.skipped += chunk.length;
				aggregate.errors.push({ row: i + 1, reason: `Upload failed (${res.status})` });
				continue;
			}
			const body = (await res.json()) as ImportResult;
			aggregate.imported += body.imported;
			aggregate.skipped += body.skipped;
			aggregate.errors.push(...body.errors.map((e) => ({ ...e, row: e.row + i })));
		}

		yield { stage: 'done', result: aggregate };
	}
</script>

<OvertureImportPage orgSlug={data.orgSlug} onImport={handleImport} />
