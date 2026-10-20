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
 * Nothing is skipped for incomplete data; gaps are filled and reported:
 *   - No country: the most common country among the org's other locations,
 *     or BACKFILL_DEFAULT_COUNTRY when the org has none at all.
 *   - No pin: the address is geocoded (US Census geocoder, US addresses only).
 *     If that finds nothing, the pin is the centre of the org's other
 *     locations in the same postcode, or failing that the same city.
 *   - No street line: the location's name becomes the building name (or
 *     "Unnamed place"). These addresses never merge with another.
 *   - No postcode or city: duplicates are matched within the rounded pin.
 * A location is only skipped when it has no country and no default, or no pin
 * and nothing to place it by; the report lists every one.
 *
 * Locations that already have a contact are never touched, so the script can
 * be rerun at any time: it only moves what is left.
 *
 * Built for large tables:
 *   - Locations are read in keyset-paginated batches, and each batch commits
 *     on its own. A failure loses one batch at most; rerunning resumes.
 *   - libpostal and the geocoder are called with several requests in flight,
 *     with retries, outside the batch transaction.
 *   - Addresses are matched through an in-memory key index per org, so a
 *     location matches an address created in an earlier batch or run.
 *
 * A dry run (the default) parses, geocodes, and matches everything but writes
 * nothing.
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
 *   LIBPOSTAL_URL             default http://localhost:4400
 *   BACKFILL_DEFAULT_COUNTRY  ISO code for orgs whose locations have no country at all, e.g. US
 *   BACKFILL_GEOCODER_URL     default https://geocoding.geo.census.gov
 *   BACKFILL_BATCH_SIZE       locations per transaction, default 500
 *   BACKFILL_CONCURRENCY      requests in flight, default 8
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
const GEOCODER_URL = (process.env.BACKFILL_GEOCODER_URL ?? 'https://geocoding.geo.census.gov').replace(
	/\/$/,
	''
);
const DEFAULT_COUNTRY = process.env.BACKFILL_DEFAULT_COUNTRY?.trim().toUpperCase() || null;
const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE ?? 500);
const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY ?? 8);
const CONTACT_TYPE = 'business';
const UNNAMED_PLACE = 'Unnamed place';

if (DEFAULT_COUNTRY && !/^[A-Z]{2}$/.test(DEFAULT_COUNTRY)) {
	throw new Error(`BACKFILL_DEFAULT_COUNTRY must be a two-letter code, got "${DEFAULT_COUNTRY}"`);
}

/** Fetches JSON, retrying a failed request twice. */
async function getJson<T>(url: string): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
			return (await res.json()) as T;
		} catch (err) {
			if (attempt >= 3) throw err;
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
}

function libpostal<T>(endpoint: 'parse' | 'expand', address: string): Promise<T> {
	return getJson<T>(`${LIBPOSTAL_URL}/${endpoint}?address=${encodeURIComponent(address)}`);
}

interface Point {
	latitude: number;
	longitude: number;
}

/** Geocodes a US street address with the Census Bureau's free geocoder. */
async function geocode(oneLine: string): Promise<Point | null> {
	const body = await getJson<{
		result?: { addressMatches?: { coordinates: { x: number; y: number } }[] };
	}>(
		`${GEOCODER_URL}/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json` +
			`&address=${encodeURIComponent(oneLine)}`
	);
	const match = body.result?.addressMatches?.[0];
	return match ? { latitude: match.coordinates.y, longitude: match.coordinates.x } : null;
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
	latitude: number;
	longitude: number;
}

interface Report {
	org: string;
	moved: number;
	addressesCreated: number;
	addressesMatched: number;
	countryFromOrg: number;
	defaultCountry: number;
	geocoded: number;
	approximatePin: string[];
	nameAsBuilding: string[];
	needsReview: string[];
	skipped: string[];
}

/** Maps every dedupe key of an address to that address's entity id, for one org. */
type KeyIndex = Map<string, string>;

/** Where a pin came from, recorded in the address's source. */
type PinSource = 'location' | 'geocoded' | 'approximate';

/** Loads the org's current addresses into the key index, so reruns match into them. */
async function indexExistingAddresses(client: pg.PoolClient, orgId: string): Promise<KeyIndex> {
	const index: KeyIndex = new Map();
	const existing = await client.query<ExistingAddressRow>(
		`SELECT entity_id, premises_name, premises_number,
		        thoroughfare_name, thoroughfare_type,
		        thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
		        locality, postcode, country_code, unit_type, unit_identifier,
		        ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude
		   FROM universe.org_address
		  WHERE org_id = $1 AND valid_to IS NULL
		    -- Name-as-building addresses (no number and no street) never merge.
		    AND (premises_number IS NOT NULL OR thoroughfare_name IS NOT NULL)`,
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
		for (const key of dedupeKeys(expansions, parsed, a.country_code, a)) {
			if (!index.has(key)) index.set(key, a.entity_id);
		}
	});

	return index;
}

/**
 * What the org's own data says about a location with gaps: the centre of its
 * pinned locations in each postcode and each city (the fallback pin), and the
 * country most of its locations are in.
 */
interface OrgContext {
	byPostcode: Map<string, Point>;
	byCity: Map<string, Point>;
	country: string | null;
}

const cityKey = (city: string, region: string | null) =>
	`${city.trim().toLowerCase()}|${(region ?? '').trim().toLowerCase()}`;

async function loadOrgContext(client: pg.PoolClient, orgId: string): Promise<OrgContext> {
	const centres = (column: string) =>
		client.query<{ area: string; region: string | null; latitude: number; longitude: number }>(
			`SELECT ${column} AS area, ${column === 'city' ? 'state_or_region' : 'NULL'} AS region,
			        ST_Y(ST_Centroid(ST_Collect(coordinates))) AS latitude,
			        ST_X(ST_Centroid(ST_Collect(coordinates))) AS longitude
			   FROM universe.org_location
			  WHERE org_id = $1 AND valid_to IS NULL AND coordinates IS NOT NULL AND ${column} IS NOT NULL
			  GROUP BY 1, 2`,
			[orgId]
		);
	// One after another: a client runs one query at a time.
	const postcodes = await centres('postal_code');
	const cities = await centres('city');
	const country = await client.query<{ country: string }>(
		`SELECT upper(trim(country_code)) AS country FROM universe.org_location
		  WHERE org_id = $1 AND valid_to IS NULL AND coalesce(trim(country_code), '') <> ''
		  GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
		[orgId]
	);
	return {
		byPostcode: new Map(postcodes.rows.map((r) => [r.area.trim().toUpperCase(), r])),
		byCity: new Map(cities.rows.map((r) => [cityKey(r.area, r.region), r])),
		country: country.rows[0]?.country ?? null
	};
}

interface Prepared {
	row: LocationRow;
	text: string;
	parsed: ParsedAddress;
	country: string;
	point: Point;
	pinSource: PinSource;
	/** Empty for name-as-building addresses, which never merge. */
	keys: string[];
}

/** Gives a location a pin: its own, a geocoded one, or its area's centre. */
async function placeLocation(
	row: LocationRow,
	country: string,
	centres: OrgContext
): Promise<{ point: Point; source: PinSource } | null> {
	if (row.latitude !== null && row.longitude !== null) {
		return { point: { latitude: row.latitude, longitude: row.longitude }, source: 'location' };
	}

	if (country === 'US' && row.address_line_1?.trim()) {
		const oneLine = [
			row.address_line_1,
			row.city,
			[row.state_or_region, row.postal_code].filter(Boolean).join(' ')
		]
			.map((part) => part?.trim())
			.filter(Boolean)
			.join(', ');
		const point = await geocode(oneLine);
		if (point) return { point, source: 'geocoded' };
	}

	const byPostcode = row.postal_code ? centres.byPostcode.get(row.postal_code.trim().toUpperCase()) : null;
	if (byPostcode) return { point: byPostcode, source: 'approximate' };
	const byCity = row.city ? centres.byCity.get(cityKey(row.city, row.state_or_region)) : null;
	if (byCity) return { point: byCity, source: 'approximate' };
	return null;
}

/** An address built from the location's name when it has no street line. */
function nameAsBuilding(row: LocationRow): ParsedAddress {
	return {
		premises_name: row.name?.trim() || UNNAMED_PLACE,
		premises_number: null,
		thoroughfare_name: null,
		thoroughfare_type: null,
		thoroughfare_pre_qualifier: null,
		thoroughfare_post_qualifier: null,
		dependent_locality: null,
		locality: row.city,
		region: row.state_or_region,
		postcode: row.postal_code,
		unit: null,
		floor: null,
		needsReview: true
	};
}

/** Fills every gap it can for one batch; what cannot be filled is reported and dropped. */
async function prepareBatch(rows: LocationRow[], centres: OrgContext, report: Report): Promise<Prepared[]> {
	const prepared = await mapLimited(rows, CONCURRENCY, async (row): Promise<Prepared | null> => {
		const own = row.country_code?.trim().toUpperCase() || null;
		const country = own ?? centres.country ?? DEFAULT_COUNTRY;
		if (!country) {
			report.skipped.push(`${row.entity_id}: no country, none in the org (set BACKFILL_DEFAULT_COUNTRY)`);
			return null;
		}
		if (!own) {
			if (centres.country) report.countryFromOrg++;
			else report.defaultCountry++;
		}

		const placed = await placeLocation(row, country, centres);
		if (!placed) {
			report.skipped.push(`${row.entity_id}: no pin, could not be geocoded or placed by postcode or city`);
			return null;
		}
		if (placed.source === 'geocoded') report.geocoded++;

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
		if (placed.source === 'approximate') report.approximatePin.push(text || row.entity_id);

		if (!row.address_line_1?.trim()) {
			report.nameAsBuilding.push(`${row.name?.trim() || UNNAMED_PLACE}${text ? `, ${text}` : ''}`);
			return {
				row,
				text,
				parsed: nameAsBuilding(row),
				country,
				point: placed.point,
				pinSource: placed.source,
				keys: []
			};
		}

		const components = await libpostal<ParsedComponent[]>('parse', text);
		const parsed = toAddressFields(components, text, row.address_line_1);
		if (parsed.needsReview) report.needsReview.push(text);

		const expansions = await libpostal<string[]>('expand', addressText(parsed));
		return {
			row,
			text,
			parsed,
			country,
			point: placed.point,
			pinSource: placed.source,
			keys: dedupeKeys(expansions, parsed, country, placed.point)
		};
	});
	return prepared.filter((p): p is Prepared => p !== null);
}

/**
 * Finds or creates the address for each prepared location and writes its
 * contact. Matching is by any shared key, against addresses from earlier
 * batches and runs as well as this one.
 */
async function writeBatch(
	client: pg.PoolClient | null,
	orgId: string,
	items: Prepared[],
	index: KeyIndex,
	report: Report
) {
	for (const item of items) {
		let addressEntityId: string | undefined = item.keys
			.map((key) => index.get(key))
			.find((id): id is string => Boolean(id));

		if (addressEntityId) {
			report.addressesMatched++;
		} else {
			const { parsed, row } = item;
			// The address's source says where its pin came from, so geocoded and
			// approximate pins can be found and checked later.
			const source = item.pinSource === 'location' ? 'backfill' : `backfill:${item.pinSource}`;
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
								country_code: item.country,
								unit_type: parsed.unit?.unit_type ?? null,
								unit_identifier: parsed.unit?.unit_identifier ?? null,
								floor: parsed.floor,
								latitude: item.point.latitude,
								longitude: item.point.longitude
							},
							null,
							source
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
				'backfill',
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
		addressesCreated: 0,
		addressesMatched: 0,
		countryFromOrg: 0,
		defaultCountry: 0,
		geocoded: 0,
		approximatePin: [],
		nameAsBuilding: [],
		needsReview: [],
		skipped: []
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

	const [index, centres] = await inOrg(pool, orgId, false, async (client) => [
		await indexExistingAddresses(client, orgId),
		await loadOrgContext(client, orgId)
	] as const);
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

		// libpostal and the geocoder run outside the transaction, so a batch holds
		// no locks while waiting on them.
		const prepared = await prepareBatch(batch, centres, report);
		if (APPLY) {
			await inOrg(pool, orgId, true, (client) => writeBatch(client, orgId, prepared, index, report));
		} else {
			await writeBatch(null, orgId, prepared, index, report);
		}

		const seconds = (Date.now() - started) / 1000;
		const done = report.moved + report.skipped.length;
		console.log(
			`  ${done}/${remaining} (${Math.round(done / seconds)}/s, ` +
				`${report.addressesCreated} new addresses, ${report.addressesMatched} matched, ` +
				`${report.geocoded} geocoded)`
		);
	}

	return report;
}

function print(report: Report) {
	const list = (lines: string[]) => lines.forEach((line) => console.log(`    ${line}`));
	console.log(`\n${report.org}`);
	console.log(`  locations moved:              ${report.moved}`);
	console.log(`  addresses created:            ${report.addressesCreated}`);
	console.log(`  existing addresses matched:   ${report.addressesMatched}`);
	console.log(`  country from org's locations: ${report.countryFromOrg}`);
	console.log(`  default country used:         ${report.defaultCountry}`);
	console.log(`  pins geocoded:                ${report.geocoded}`);
	console.log(`  approximate pins (area centre): ${report.approximatePin.length}`);
	list(report.approximatePin);
	console.log(`  name used as building (no street line): ${report.nameAsBuilding.length}`);
	list(report.nameAsBuilding);
	console.log(`  needs review (no building number or name found): ${report.needsReview.length}`);
	list(report.needsReview);
	console.log(`  skipped:                      ${report.skipped.length}`);
	list(report.skipped);
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
			(APPLY
				? `Applying, ${BATCH_SIZE} locations per transaction.`
				: 'Dry run: nothing will be written. Pass --apply to write.') +
				` Default country: ${DEFAULT_COUNTRY ?? 'none'}.`
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
