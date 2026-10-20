#!/usr/bin/env tsx
/**
 * Moves locations onto structured addresses as contacts (expand step of the
 * address migration, see steps 41 and 42 in src/lib/server/setup-schema.ts).
 *
 * Every current location without a contact becomes a 'business' contact that
 * reuses the location's entity id, keeps its photos, and takes its name (an
 * empty string when it has none). Its address text is parsed into S42 fields
 * with libpostal, and spelling variants of one address are merged. A unit
 * ("Apt 4B") is an address of its own, so two apartments stay two addresses.
 *
 * Built for large tables:
 *   - Locations are read in keyset-paginated batches, and each batch commits
 *     on its own. A failure loses one batch at most; rerunning resumes, since
 *     locations that already have a contact are skipped.
 *   - libpostal is called with several requests in flight, with retries.
 *   - Addresses are matched through an in-memory key index per org, so a
 *     location matches an address created in an earlier batch or run.
 *
 * A dry run (the default) parses and matches everything but writes nothing.
 *
 * libpostal runs as an HTTP service and holds about 2 GB in memory. Run it
 * next to the database, not on a laptop, and cap it:
 *   docker run -d --name libpostal --memory 3g -p 4400:4400 pelias/libpostal-service
 *
 * Usage:
 *   tsx scripts/backfill-addresses.ts           # dry run: report, write nothing
 *   tsx scripts/backfill-addresses.ts --apply   # write
 *
 * Env:
 *   DATABASE_URL
 *   LIBPOSTAL_URL          default http://localhost:4400
 *   BACKFILL_BATCH_SIZE    locations per transaction, default 500
 *   BACKFILL_CONCURRENCY   libpostal requests in flight, default 8
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { insertAddress } from '$lib/server/services/addresses.service';
import { insertContact } from '$lib/server/services/contacts.service';
import {
	addressText,
	dedupeKeys,
	toAddressFields,
	type ParsedAddress,
	type ParsedComponent
} from '$lib/shared/utils/address-parse';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIBPOSTAL_URL = (process.env.LIBPOSTAL_URL ?? 'http://localhost:4400').replace(/\/$/, '');
const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE ?? 500);
const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY ?? 8);
const SOURCE = 'backfill';
const CONTACT_TYPE = 'business';

async function libpostal<T>(endpoint: 'parse' | 'expand', address: string): Promise<T> {
	const url = `${LIBPOSTAL_URL}/${endpoint}?address=${encodeURIComponent(address)}`;
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`libpostal ${endpoint} returned ${res.status}`);
			return (await res.json()) as T;
		} catch (err) {
			if (attempt >= 3) throw err;
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
}

/** Runs `fn` over `items` with at most `limit` calls in flight, keeping order. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

interface LocationRow {
	id: string;
	entity_id: string;
	name: string | null;
	photo_keys: string[];
	address_line_1: string | null;
	address_line_2: string | null;
	address_line_3: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	country_code: string | null;
	latitude: number | null;
	longitude: number | null;
}

interface ExistingAddressRow {
	entity_id: string;
	premises_name: string | null;
	premises_number: string | null;
	thoroughfare_name: string | null;
	thoroughfare_type: string | null;
	thoroughfare_pre_qualifier: string | null;
	thoroughfare_post_qualifier: string | null;
	locality: string | null;
	postcode: string | null;
	country_code: string;
	unit_type: string | null;
	unit_identifier: string | null;
}

interface Report {
	org: string;
	moved: number;
	skipped: string[];
	needsReview: string[];
	addressesCreated: number;
	addressesMatched: number;
}

/** Maps every dedupe key of an address to that address's entity id, for one org. */
type KeyIndex = Map<string, string>;

/** Loads the org's current addresses into the key index, so reruns match into them. */
async function indexExistingAddresses(client: pg.PoolClient, orgId: string): Promise<KeyIndex> {
	const index: KeyIndex = new Map();
	const existing = await client.query<ExistingAddressRow>(
		`SELECT entity_id, premises_name, premises_number,
		        thoroughfare_name, thoroughfare_type,
		        thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
		        locality, postcode, country_code, unit_type, unit_identifier
		   FROM universe.org_address
		  WHERE org_id = $1 AND valid_to IS NULL`,
		[orgId]
	);

	await mapLimited(existing.rows, CONCURRENCY, async (a) => {
		const parsed: ParsedAddress = {
			premises_name: a.premises_name,
			premises_number: a.premises_number,
			thoroughfare_name: a.thoroughfare_name,
			thoroughfare_type: a.thoroughfare_type,
			thoroughfare_pre_qualifier: a.thoroughfare_pre_qualifier,
			thoroughfare_post_qualifier: a.thoroughfare_post_qualifier,
			dependent_locality: null,
			locality: a.locality,
			region: null,
			postcode: a.postcode,
			unit: a.unit_identifier ? { unit_type: a.unit_type, unit_identifier: a.unit_identifier } : null,
			floor: null,
			needsReview: false
		};
		const expansions = await libpostal<string[]>('expand', addressText(parsed));
		for (const key of dedupeKeys(expansions, parsed, a.country_code)) {
			if (!index.has(key)) index.set(key, a.entity_id);
		}
	});

	return index;
}

interface Parsed {
	row: LocationRow;
	text: string;
	parsed: ParsedAddress;
	keys: string[];
}

/** Parses one batch with libpostal; locations that cannot be parsed are reported and dropped. */
async function parseBatch(rows: LocationRow[], report: Report): Promise<Parsed[]> {
	const parsed = await mapLimited(rows, CONCURRENCY, async (row): Promise<Parsed | null> => {
		if (!row.address_line_1?.trim() || !row.country_code || row.latitude === null) {
			report.skipped.push(`${row.entity_id}: missing line 1, country, or coordinates`);
			return null;
		}
		const text = [
			row.address_line_1,
			row.address_line_2,
			row.address_line_3,
			row.city,
			[row.state_or_region, row.postal_code].filter(Boolean).join(' ')
		]
			.map((part) => part?.trim())
			.filter(Boolean)
			.join(', ');

		const components = await libpostal<ParsedComponent[]>('parse', text);
		const fields = toAddressFields(components, text, row.address_line_1);
		if (fields.needsReview) report.needsReview.push(text);

		const expansions = await libpostal<string[]>('expand', addressText(fields));
		return {
			row,
			text,
			parsed: fields,
			keys: dedupeKeys(expansions, fields, row.country_code.toUpperCase())
		};
	});
	return parsed.filter((p): p is Parsed => p !== null);
}

/**
 * Finds or creates the address for each parsed location and writes its
 * contact. Matching is by any shared key, against addresses from earlier
 * batches and runs as well as this one.
 */
async function writeBatch(
	client: pg.PoolClient | null,
	orgId: string,
	items: Parsed[],
	index: KeyIndex,
	report: Report
) {
	for (const item of items) {
		let addressEntityId = item.keys.map((key) => index.get(key)).find(Boolean);

		if (addressEntityId) {
			report.addressesMatched++;
		} else {
			const { parsed, row } = item;
			addressEntityId = client
				? (
						await insertAddress(
							client,
							orgId,
							{
								premises_name: parsed.premises_name,
								premises_number: parsed.premises_number,
								thoroughfare_name: parsed.thoroughfare_name,
								thoroughfare_type: parsed.thoroughfare_type,
								thoroughfare_pre_qualifier: parsed.thoroughfare_pre_qualifier,
								thoroughfare_post_qualifier: parsed.thoroughfare_post_qualifier,
								dependent_locality: parsed.dependent_locality,
								locality: parsed.locality ?? row.city,
								region: parsed.region ?? row.state_or_region,
								postcode: parsed.postcode ?? row.postal_code,
								country_code: row.country_code!.toUpperCase(),
								unit_type: parsed.unit?.unit_type ?? null,
								unit_identifier: parsed.unit?.unit_identifier ?? null,
								floor: parsed.floor,
								latitude: row.latitude!,
								longitude: row.longitude!
							},
							null,
							SOURCE
						)
					).entityId
				: randomUUID(); // dry run: a stand-in id so later locations still match
			for (const key of item.keys) {
				if (!index.has(key)) index.set(key, addressEntityId);
			}
			report.addressesCreated++;
		}

		if (client) {
			await insertContact(
				client,
				orgId,
				{
					type: CONTACT_TYPE,
					addressEntityId,
					metadata: { name: item.row.name ?? '' },
					photoKeys: item.row.photo_keys
				},
				null,
				SOURCE,
				item.row.entity_id
			);
		}
		report.moved++;
	}
}

/** Opens a transaction scoped to one org; RLS is forced on every table involved. */
async function inOrg<T>(pool: pg.Pool, orgId: string, commit: boolean, fn: (c: pg.PoolClient) => Promise<T>) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgId]);
		const result = await fn(client);
		await client.query(commit ? 'COMMIT' : 'ROLLBACK');
		return result;
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}

async function backfillOrg(pool: pg.Pool, orgId: string, orgName: string): Promise<Report> {
	const report: Report = {
		org: orgName,
		moved: 0,
		skipped: [],
		needsReview: [],
		addressesCreated: 0,
		addressesMatched: 0
	};

	const remaining = await inOrg(pool, orgId, false, async (client) => {
		const result = await client.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM universe.org_location ol
			  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
			    AND NOT EXISTS (SELECT 1 FROM universe.org_contact c
			                     WHERE c.entity_id = ol.entity_id AND c.org_id = $1 AND c.valid_to IS NULL)`,
			[orgId]
		);
		return Number(result.rows[0].count);
	});
	console.log(`\n${orgName}: ${remaining} locations to move`);
	if (remaining === 0) return report;

	const index = await inOrg(pool, orgId, false, (client) => indexExistingAddresses(client, orgId));
	console.log(`  indexed ${new Set(index.values()).size} existing addresses`);

	// Keyset pagination on the version id: a dry run writes nothing, so "not yet
	// moved" alone would return the same batch forever. (Not on valid_from:
	// JavaScript dates drop its microseconds, which would repeat or skip rows.)
	let after: string | null = null;
	const started = Date.now();

	for (;;) {
		const batch: LocationRow[] = await inOrg(pool, orgId, false, async (client) => {
			const result = await client.query<LocationRow>(
				`SELECT ol.id, ol.entity_id, ol.name, ol.photo_keys,
				        ol.address_line_1, ol.address_line_2, ol.address_line_3,
				        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
				        ST_Y(ol.coordinates) AS latitude, ST_X(ol.coordinates) AS longitude
				   FROM universe.org_location ol
				  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
				    AND NOT EXISTS (SELECT 1 FROM universe.org_contact c
				                     WHERE c.entity_id = ol.entity_id AND c.org_id = $1 AND c.valid_to IS NULL)
				    AND ($2::uuid IS NULL OR ol.id > $2::uuid)
				  ORDER BY ol.id
				  LIMIT $3`,
				[orgId, after, BATCH_SIZE]
			);
			return result.rows;
		});
		if (batch.length === 0) break;
		after = batch[batch.length - 1].id;

		// libpostal runs outside the transaction, so a batch holds no locks while parsing.
		const parsed = await parseBatch(batch, report);
		if (APPLY) {
			await inOrg(pool, orgId, true, (client) => writeBatch(client, orgId, parsed, index, report));
		} else {
			await writeBatch(null, orgId, parsed, index, report);
		}

		const seconds = (Date.now() - started) / 1000;
		const done = report.moved + report.skipped.length;
		console.log(
			`  ${done}/${remaining} (${Math.round(done / seconds)}/s, ` +
				`${report.addressesCreated} new addresses, ${report.addressesMatched} matched)`
		);
	}

	return report;
}

function print(report: Report) {
	console.log(`\n${report.org}`);
	console.log(`  locations moved:              ${report.moved}`);
	console.log(`  addresses created:            ${report.addressesCreated}`);
	console.log(`  existing addresses matched:   ${report.addressesMatched}`);
	console.log(`  skipped:                      ${report.skipped.length}`);
	for (const line of report.skipped) console.log(`    ${line}`);
	console.log(`  needs review (no building number or name found): ${report.needsReview.length}`);
	for (const line of report.needsReview) console.log(`    ${line}`);
}

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	try {
		const schema = await pool.query<{ ready: boolean }>(
			`SELECT to_regclass('universe.org_contact') IS NOT NULL AS ready`
		);
		if (!schema.rows[0].ready) {
			throw new Error('universe.org_contact does not exist. Run /infra/migrate first.');
		}

		const orgs = await pool.query<{ id: string; name: string }>(
			`SELECT id, name FROM auth.organization ORDER BY name`
		);
		console.log(
			APPLY
				? `Applying, ${BATCH_SIZE} locations per transaction.`
				: 'Dry run: nothing will be written. Pass --apply to write.'
		);
		for (const org of orgs.rows) print(await backfillOrg(pool, org.id, org.name));
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
