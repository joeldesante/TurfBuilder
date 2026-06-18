#!/usr/bin/env tsx
/**
 * Interactive location importer.
 * Usage: tsx scripts/import-locations.ts <file.csv|file.geojson|file.parquet>
 *
 * Parquet support requires: npm install hyparquet
 */

import rl from 'readline/promises';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ── Destination field definitions ─────────────────────────────────────────────

const DEST_FIELDS = [
	'source_ref',
	'name',
	'address_line_1',
	'address_line_2',
	'address_line_3',
	'city',
	'state_or_region',
	'postal_code',
	'country_code',
	'latitude',
	'longitude'
] as const;

type DestField = (typeof DEST_FIELDS)[number];
type FieldMapping = Partial<Record<DestField, string>>;
type Row = Record<string, unknown>;

// ── File readers ──────────────────────────────────────────────────────────────

function readCSV(filePath: string): Row[] {
	const text = fs.readFileSync(filePath, 'utf-8');
	const result = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
	return result.data;
}

function readGeoJSON(filePath: string): Row[] {
	const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
	const features = raw.type === 'FeatureCollection' ? raw.features : [raw];
	return features.map((f: { properties: Row; geometry?: { coordinates?: number[] } }) => ({
		...f.properties,
		_latitude: f.geometry?.coordinates?.[1] ?? null,
		_longitude: f.geometry?.coordinates?.[0] ?? null
	}));
}

async function readParquet(filePath: string): Promise<Row[]> {
	let parquetRead: (opts: { file: ArrayBuffer; onComplete: (data: Row[]) => void }) => Promise<void>;
	try {
		const mod = await import('hyparquet');
		parquetRead = mod.parquetRead;
	} catch {
		console.error('Parquet support requires: npm install hyparquet');
		process.exit(1);
	}

	const buffer = fs.readFileSync(filePath).buffer;
	const rows: Row[] = [];
	await parquetRead({ file: buffer, rowFormat: 'object', onComplete: (data) => { for (const r of data as Row[]) rows.push(r); } });
	return rows;
}

// ── Auto-suggest column mappings ──────────────────────────────────────────────

const FIELD_ALIASES: Record<DestField, string[]> = {
	source_ref: ['id', 'gers_id', 'source_ref', 'external_id', 'gid'],
	name: ['name', 'location_name', 'place_name', 'title'],
	address_line_1: ['address_line_1', 'address1', 'street_address', 'address', 'freeform'],
	address_line_2: ['address_line_2', 'address2', 'unit', 'suite'],
	address_line_3: ['address_line_3', 'address3'],
	city: ['city', 'locality', 'town', 'municipality'],
	state_or_region: ['state_or_region', 'state', 'region', 'province'],
	postal_code: ['postal_code', 'postcode', 'zip', 'zip_code'],
	country_code: ['country_code', 'country', 'iso_country'],
	latitude: ['latitude', 'lat', '_latitude'],
	longitude: ['longitude', 'lon', 'lng', 'long', '_longitude']
};

function autoSuggest(columns: string[]): Record<string, string> {
	const index = Object.fromEntries(columns.map((c) => [c.toLowerCase(), c]));
	const suggestions: Record<string, string> = {};
	for (const [dest, aliases] of Object.entries(FIELD_ALIASES)) {
		for (const alias of aliases) {
			if (index[alias]) {
				suggestions[dest] = index[alias];
				break;
			}
		}
	}
	return suggestions;
}

// ── Interactive column mapping ─────────────────────────────────────────────────

async function promptMapping(
	iface: rl.Interface,
	columns: string[],
	suggestions: Record<string, string>
): Promise<FieldMapping> {
	console.log('\nDetected source columns:');
	columns.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
	console.log(
		'\nMap source columns to destination fields (column name or number, Enter to skip):\n'
	);

	const mapping: FieldMapping = {};

	for (const dest of DEST_FIELDS) {
		const suggested = suggestions[dest];
		const hint = suggested ? ` [suggested: "${suggested}"]` : '';
		const answer = (await iface.question(`  ${dest}${hint}: `)).trim();

		if (answer === '' && suggested && columns.includes(suggested)) {
			mapping[dest] = suggested;
		} else if (columns.includes(answer)) {
			mapping[dest] = answer;
		} else if (/^\d+$/.test(answer)) {
			const col = columns[parseInt(answer) - 1];
			if (col) mapping[dest] = col;
		}
	}

	return mapping;
}

// ── Upsert logic ──────────────────────────────────────────────────────────────

function getValue(row: Row, mapping: FieldMapping, field: DestField): unknown {
	const col = mapping[field];
	return col !== undefined ? (row[col] ?? null) : null;
}

async function upsertPublicLocation(
	client: pg.PoolClient,
	row: Row,
	mapping: FieldMapping,
	source: string,
	entityTypeId: string
) {
	const sourceRef = getValue(row, mapping, 'source_ref') as string | null;
	const lat = getValue(row, mapping, 'latitude');
	const lng = getValue(row, mapping, 'longitude');
	const latNum = lat !== null ? parseFloat(String(lat)) : null;
	const lngNum = lng !== null ? parseFloat(String(lng)) : null;

	let entityId: string;

	if (sourceRef) {
		const existing = await client.query<{ id: string }>(
			`SELECT id FROM universe.public_entity WHERE source_ref = $1 LIMIT 1`,
			[sourceRef]
		);
		if (existing.rows[0]) {
			entityId = existing.rows[0].id;
			await client.query(
				`UPDATE universe.public_location SET valid_to = now() WHERE entity_id = $1 AND valid_to IS NULL`,
				[entityId]
			);
		} else {
			const res = await client.query<{ id: string }>(
				`INSERT INTO universe.public_entity (type_id, source_ref) VALUES ($1, $2) RETURNING id`,
				[entityTypeId, sourceRef]
			);
			entityId = res.rows[0].id;
		}
	} else {
		const res = await client.query<{ id: string }>(
			`INSERT INTO universe.public_entity (type_id) VALUES ($1) RETURNING id`,
			[entityTypeId]
		);
		entityId = res.rows[0].id;
	}

	await client.query(
		`INSERT INTO universe.public_location
		 (entity_id, name, address_line_1, address_line_2, address_line_3,
		  city, state_or_region, postal_code, country_code, coordinates, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
		   CASE WHEN $10::float8 IS NOT NULL AND $11::float8 IS NOT NULL
		        THEN ST_SetSRID(ST_MakePoint($11::float8, $10::float8), 4326)
		        ELSE NULL END,
		   $12)`,
		[
			entityId,
			getValue(row, mapping, 'name'),
			getValue(row, mapping, 'address_line_1'),
			getValue(row, mapping, 'address_line_2'),
			getValue(row, mapping, 'address_line_3'),
			getValue(row, mapping, 'city'),
			getValue(row, mapping, 'state_or_region'),
			getValue(row, mapping, 'postal_code'),
			getValue(row, mapping, 'country_code'),
			latNum,
			lngNum,
			source
		]
	);
}

async function upsertOrgLocation(
	client: pg.PoolClient,
	row: Row,
	mapping: FieldMapping,
	source: string,
	orgId: string,
	entityTypeId: string
) {
	const sourceRef = getValue(row, mapping, 'source_ref') as string | null;
	const lat = getValue(row, mapping, 'latitude');
	const lng = getValue(row, mapping, 'longitude');
	const latNum = lat !== null ? parseFloat(String(lat)) : null;
	const lngNum = lng !== null ? parseFloat(String(lng)) : null;

	let entityId: string;

	if (sourceRef) {
		const existing = await client.query<{ id: string }>(
			`SELECT id FROM universe.org_entity WHERE org_id = $1 AND source_ref = $2 LIMIT 1`,
			[orgId, sourceRef]
		);
		if (existing.rows[0]) {
			entityId = existing.rows[0].id;
			await client.query(
				`UPDATE universe.org_location SET valid_to = now() WHERE entity_id = $1 AND valid_to IS NULL`,
				[entityId]
			);
		} else {
			const res = await client.query<{ id: string }>(
				`INSERT INTO universe.org_entity (org_id, type_id, source_ref) VALUES ($1, $2, $3) RETURNING id`,
				[orgId, entityTypeId, sourceRef]
			);
			entityId = res.rows[0].id;
		}
	} else {
		const res = await client.query<{ id: string }>(
			`INSERT INTO universe.org_entity (org_id, type_id) VALUES ($1, $2) RETURNING id`,
			[orgId, entityTypeId]
		);
		entityId = res.rows[0].id;
	}

	await client.query(
		`INSERT INTO universe.org_location
		 (org_id, entity_id, name, address_line_1, address_line_2, address_line_3,
		  city, state_or_region, postal_code, country_code, coordinates, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
		   CASE WHEN $11::float8 IS NOT NULL AND $12::float8 IS NOT NULL
		        THEN ST_SetSRID(ST_MakePoint($12::float8, $11::float8), 4326)
		        ELSE NULL END,
		   $13)`,
		[
			orgId,
			entityId,
			getValue(row, mapping, 'name'),
			getValue(row, mapping, 'address_line_1'),
			getValue(row, mapping, 'address_line_2'),
			getValue(row, mapping, 'address_line_3'),
			getValue(row, mapping, 'city'),
			getValue(row, mapping, 'state_or_region'),
			getValue(row, mapping, 'postal_code'),
			getValue(row, mapping, 'country_code'),
			latNum,
			lngNum,
			source
		]
	);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	const iface = rl.createInterface({ input: process.stdin, output: process.stdout });

	let filePath = process.argv[2];
	if (!filePath) {
		filePath = (await iface.question('File path (.csv, .geojson, .parquet): ')).trim();
	}
	if (!filePath) {
		console.error('No file provided.');
		process.exit(1);
	}
	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		process.exit(1);
	}

	const ext = path.extname(filePath).toLowerCase();

	try {
		console.log(`\nReading ${ext} file...`);

		let rows: Row[];
		if (ext === '.csv') {
			rows = readCSV(filePath);
		} else if (ext === '.geojson' || ext === '.json') {
			rows = readGeoJSON(filePath);
		} else if (ext === '.parquet') {
			rows = await readParquet(filePath);
		} else {
			console.error(`Unsupported file type: ${ext}. Use .csv, .geojson, or .parquet`);
			process.exit(1);
		}

		if (rows.length === 0) {
			console.error('No rows found.');
			process.exit(1);
		}

		console.log(`Found ${rows.length} rows.`);

		const columns = Object.keys(rows[0]);
		const suggestions = autoSuggest(columns);
		const mapping = await promptMapping(iface, columns, suggestions);

		console.log('\nMapping:');
		for (const dest of DEST_FIELDS) {
			const src = mapping[dest];
			console.log(`  ${dest.padEnd(18)} <- ${src ?? '(skipped)'}`);
		}

		const source = (await iface.question('\nSource label (e.g. "overture", "voter_file"): ')).trim();
		if (!source) {
			console.error('Source label is required.');
			process.exit(1);
		}

		const scopeAnswer = (
			await iface.question('Entity scope — (p)ublic or (o)rg? [p]: ')
		)
			.trim()
			.toLowerCase();
		const isOrg = scopeAnswer === 'o' || scopeAnswer === 'org';
		let orgId: string | null = null;
		if (isOrg) {
			orgId = (await iface.question('Organization ID (UUID): ')).trim();
			if (!orgId) {
				console.error('Organization ID is required for org scope.');
				process.exit(1);
			}
		}

		const confirm = await iface.question(`\nImport ${rows.length} records into ${isOrg ? 'org' : 'public'} tables? [y/N]: `);
		if (confirm.trim().toLowerCase() !== 'y') {
			console.log('Aborted.');
			process.exit(0);
		}

		const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
		console.log(process.env.DATABASE_URL)
		const client = await pool.connect();

		try {
			const typeRes = await client.query<{ id: string }>(
				`SELECT id FROM universe.entity_type WHERE slug = 'location' LIMIT 1`
			);
			if (!typeRes.rows[0]) {
				console.error('No entity_type with slug "location" found. Run /infra/migrate first.');
				process.exit(1);
			}
			const entityTypeId = typeRes.rows[0].id;

			await client.query('BEGIN');
			let imported = 0;
			let errors = 0;

			for (let i = 0; i < rows.length; i++) {
				try {
					if (isOrg && orgId) {
						await upsertOrgLocation(client, rows[i], mapping, source, orgId, entityTypeId);
					} else {
						await upsertPublicLocation(client, rows[i], mapping, source, entityTypeId);
					}
					imported++;
					if (imported % 100 === 0) {
						process.stdout.write(`\r  ${imported}/${rows.length}...`);
					}
				} catch (err) {
					errors++;
					console.error(`\nRow ${i + 1} error: ${(err as Error).message}`);
				}
			}

			await client.query('COMMIT');
			console.log(`\n\nDone. ${imported} imported, ${errors} errors.`);
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
			await pool.end();
		}
	} finally {
		iface.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
