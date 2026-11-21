#!/usr/bin/env tsx
/**
 * Interactive location importer: each row becomes a contact at an address,
 * as the import page writes them. Rows need a latitude and longitude.
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
import { insertAddress } from '$lib/server/services/addresses.service';
import { createContactVersion, insertContact } from '$lib/server/services/contacts.service';
import { locationToAddress } from '$lib/shared/utils/location-address';

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

/**
 * Writes one row as a location: a contact at a new address. A row whose
 * source_ref names an existing location replaces it with a new version (at
 * the new address), so lists and turfs keep the version they recorded.
 */
async function upsertOrgLocation(
	client: pg.PoolClient,
	row: Row,
	mapping: FieldMapping,
	source: string,
	orgId: string,
	defaultCountry: string
) {
	const text = (field: DestField) => {
		const value = getValue(row, mapping, field);
		return value === null || value === undefined || String(value).trim() === ''
			? null
			: String(value).trim();
	};
	const sourceRef = text('source_ref');
	const latitude = parseFloat(String(getValue(row, mapping, 'latitude')));
	const longitude = parseFloat(String(getValue(row, mapping, 'longitude')));
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		throw new Error('latitude and longitude are required');
	}

	const name = text('name');
	const address = locationToAddress(
		{
			name,
			address_line_1: text('address_line_1'),
			address_line_2: text('address_line_2'),
			city: text('city'),
			state_or_region: text('state_or_region'),
			postal_code: text('postal_code'),
			country_code: text('country_code'),
			latitude,
			longitude
		},
		defaultCountry
	);
	const { entityId: addressEntityId } = await insertAddress(client, orgId, address, null, source);
	const contact = {
		type: 'business',
		addressEntityId,
		metadata: { name: (name ?? '').slice(0, 255) }
	};

	const existing = sourceRef
		? await client.query<{ id: string }>(
				`SELECT e.id FROM universe.org_entity e
				  WHERE e.org_id = $1 AND e.source_ref = $2
				    AND EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.entity_id = e.id)
				  LIMIT 1`,
				[orgId, sourceRef]
			)
		: null;

	if (existing?.rows[0]) {
		await createContactVersion(client, orgId, existing.rows[0].id, contact, null, source);
		return;
	}

	const entity = await client.query<{ id: string }>(
		`INSERT INTO universe.org_entity (org_id, source_ref) VALUES ($1, $2) RETURNING id`,
		[orgId, sourceRef]
	);
	await insertContact(client, orgId, contact, null, source, entity.rows[0].id);
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

		const orgId = (await iface.question('Organization ID (UUID): ')).trim();
		if (!orgId) {
			console.error('Organization ID is required.');
			process.exit(1);
		}

		const confirm = await iface.question(`\nImport ${rows.length} records into organization ${orgId}? [y/N]: `);
		if (confirm.trim().toLowerCase() !== 'y') {
			console.log('Aborted.');
			process.exit(0);
		}

		const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
		const client = await pool.connect();

		try {
			// The tables are under forced row-level security.
			await client.query('BEGIN');
			await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgId]);
			const country = await client.query<{ country_code: string }>(
				`SELECT country_code FROM universe.org_address
				  WHERE org_id = $1 AND valid_to IS NULL
				  GROUP BY country_code ORDER BY count(*) DESC LIMIT 1`,
				[orgId]
			);
			const defaultCountry = country.rows[0]?.country_code ?? 'US';

			let imported = 0;
			let errors = 0;

			for (let i = 0; i < rows.length; i++) {
				// A savepoint per row, so one bad row does not abort the rest.
				await client.query('SAVEPOINT import_row');
				try {
					await upsertOrgLocation(client, rows[i], mapping, source, orgId, defaultCountry);
					await client.query('RELEASE SAVEPOINT import_row');
					imported++;
					if (imported % 100 === 0) {
						process.stdout.write(`\r  ${imported}/${rows.length}...`);
					}
				} catch (err) {
					await client.query('ROLLBACK TO SAVEPOINT import_row');
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
