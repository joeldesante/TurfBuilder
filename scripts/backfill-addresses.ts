#!/usr/bin/env tsx
/**
 * Copies locations onto structured addresses as contacts, with their whole
 * history (address migration, see the addresses and contacts migrations in
 * migrations/ and issue #237).
 *
 * Every version of every location, current, superseded, and deleted, becomes
 * a 'business' contact version (every location so far is a business) that is
 * the same row in all but shape:
 *   - the same id, so list_entry.record_id and turf_location.org_location_id
 *     already point at it and switching them over needs no lookup;
 *   - the same entity id, valid_from, valid_to, created_at, authored_by,
 *     source, and photos, copied by the database so no microsecond is lost;
 *   - metadata { name } from the location's name (an empty string when none).
 * Its address text is parsed into S42 fields with libpostal, and spelling
 * variants of one address are merged into one address entity. A unit
 * ("Apt 4B") is an address of its own, so two apartments stay two addresses.
 * Each address is dated from the earliest contact version that uses it.
 *
 * An address keeps one pin: the pin of the newest location version that uses
 * it. A location version that differs from a later one only by its pin points
 * at the same address, so its old pin is not carried over (org_location keeps
 * it until locations are retired).
 *
 * Nothing is skipped for incomplete data; gaps are filled and reported:
 *   - No country: the most common country among the org's other locations,
 *     or BACKFILL_DEFAULT_COUNTRY when the org has none at all.
 *   - No pin: the address is geocoded (US Census geocoder, US addresses only).
 *     If that finds nothing, the pin is the centre of the org's other
 *     locations in the same postcode, or failing that the same city. An old
 *     version that still cannot be placed takes the address of a newer
 *     version of the same location.
 *   - No street line: the location's name becomes the building name (or
 *     "Unnamed place"). These addresses never merge with another location's.
 *   - No postcode or city: duplicates are matched within the rounded pin.
 * A version is only skipped when none of these work; the report lists each.
 *
 * Rerunnable at any time, and safe to run until the app moves onto contacts:
 *   - Versions already copied (a contact with the same id) are not copied
 *     again; new versions since the last run are.
 *   - A location edited or deleted since the last run has its copied
 *     version's valid_to brought in line first.
 *   - Contacts written by the earlier current-version-only backfill (source
 *     'backfill', an id that is no location version) are replaced, and
 *     backfill addresses no contact uses any more are removed.
 * Each org ends with a check that every location version has an identical
 * contact version; the script exits non-zero when one does not.
 *
 * Built for large tables:
 *   - Locations are read in keyset-paginated batches of entities (all of an
 *     entity's versions together), and each batch commits on its own. A
 *     failure loses one batch at most; rerunning resumes.
 *   - libpostal and the geocoder are called with several requests in flight,
 *     with retries, outside the batch transaction, and each distinct address
 *     text is parsed once.
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
 *   BACKFILL_BATCH_SIZE       locations (entities) per transaction, default 500
 *   BACKFILL_CONCURRENCY      requests in flight, default 8
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { insertAddress } from '$lib/server/services/addresses.service';
import { validateContactMetadata } from '$lib/shared/contact-types';
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
const MAX_NAME_LENGTH = 255;
/** The source the earlier current-version-only backfill gave its contacts. */
const LEGACY_CONTACT_SOURCE = 'backfill';

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

/** One request per distinct text for the whole run: versions repeat their address. */
const libpostalCache = new Map<string, Promise<unknown>>();

function libpostal<T>(endpoint: 'parse' | 'expand', address: string): Promise<T> {
	const key = `${endpoint}\n${address}`;
	let cached = libpostalCache.get(key);
	if (!cached) {
		cached = getJson<T>(`${LIBPOSTAL_URL}/${endpoint}?address=${encodeURIComponent(address)}`);
		// A failure is not cached, so a later version can retry it.
		cached.catch(() => libpostalCache.delete(key));
		libpostalCache.set(key, cached);
	}
	return cached as Promise<T>;
}

interface Point {
	latitude: number;
	longitude: number;
}

const geocodeCache = new Map<string, Promise<Point | null>>();

/** Geocodes a US street address with the Census Bureau's free geocoder. */
function geocode(oneLine: string): Promise<Point | null> {
	let cached = geocodeCache.get(oneLine);
	if (!cached) {
		cached = getJson<{
			result?: { addressMatches?: { coordinates: { x: number; y: number } }[] };
		}>(
			`${GEOCODER_URL}/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json` +
				`&address=${encodeURIComponent(oneLine)}`
		).then((body) => {
			const match = body.result?.addressMatches?.[0];
			return match ? { latitude: match.coordinates.y, longitude: match.coordinates.x } : null;
		});
		cached.catch(() => geocodeCache.delete(oneLine));
		geocodeCache.set(oneLine, cached);
	}
	return cached;
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

/**
 * One location version. Only what the address and the name need: everything
 * that is copied as-is (dates, author, source, photos) is copied in SQL.
 */
interface LocationRow {
	id: string;
	entity_id: string;
	name: string | null;
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
	versionsCopied: number;
	legacyContactsReplaced: number;
	validToSynced: number;
	addressesCreated: number;
	addressesMatched: number;
	addressesBackdated: number;
	orphanAddressesRemoved: number;
	countryFromOrg: number;
	defaultCountry: number;
	geocoded: number;
	addressFromNewerVersion: number;
	namesTruncated: number;
	approximatePin: string[];
	nameAsBuilding: string[];
	needsReview: string[];
	skipped: string[];
	check: CheckResult | null;
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
 * country most of its locations are in. Read from current versions.
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
		  WHERE org_id = $1 AND coalesce(trim(country_code), '') <> ''
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
	parsed: ParsedAddress;
	country: string;
	point: Point;
	pinSource: PinSource;
	/** Empty for name-as-building addresses, which never merge with another location's. */
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

function oneLineText(row: LocationRow): string {
	return [
		row.address_line_1,
		row.address_line_2,
		row.address_line_3,
		row.city,
		[row.state_or_region, row.postal_code].filter(Boolean).join(' ')
	]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(', ');
}

/**
 * Fills every gap it can for one batch of versions. A version that cannot be
 * placed is returned as null and reported only if no newer version of the
 * same location lends it an address (see writeBatch).
 */
async function prepareBatch(
	rows: LocationRow[],
	centres: OrgContext,
	report: Report,
	reasons: Map<string, string>
): Promise<(Prepared | null)[]> {
	return mapLimited(rows, CONCURRENCY, async (row): Promise<Prepared | null> => {
		const own = row.country_code?.trim().toUpperCase() || null;
		const country = own ?? centres.country ?? DEFAULT_COUNTRY;
		if (!country) {
			reasons.set(row.id, 'no country, none in the org (set BACKFILL_DEFAULT_COUNTRY)');
			return null;
		}

		const placed = await placeLocation(row, country, centres);
		if (!placed) {
			reasons.set(row.id, 'no pin, could not be geocoded or placed by postcode or city');
			return null;
		}

		if (!own) {
			if (centres.country) report.countryFromOrg++;
			else report.defaultCountry++;
		}
		if (placed.source === 'geocoded') report.geocoded++;

		const text = oneLineText(row);
		if (placed.source === 'approximate') report.approximatePin.push(text || row.entity_id);

		if (!row.address_line_1?.trim()) {
			return { row, parsed: nameAsBuilding(row), country, point: placed.point, pinSource: placed.source, keys: [] };
		}

		const components = await libpostal<ParsedComponent[]>('parse', text);
		const parsed = toAddressFields(components, text, row.address_line_1);
		const expansions = await libpostal<string[]>('expand', addressText(parsed));
		return {
			row,
			parsed,
			country,
			point: placed.point,
			pinSource: placed.source,
			keys: dedupeKeys(expansions, parsed, country, placed.point)
		};
	});
}

/**
 * Name-as-building addresses never merge across locations, but every version
 * of one location with the same name and area shares one. Keyed per entity.
 */
function namelessKey(item: Prepared): string {
	const { row, parsed } = item;
	return [row.entity_id, parsed.premises_name, row.city, row.state_or_region, row.postal_code, item.country]
		.map((part) => (part ?? '').trim().toLowerCase())
		.join('|');
}

/** The contact's name, cut to what the business metadata allows. */
function contactMetadata(row: LocationRow, report: Report): Record<string, unknown> {
	let name = row.name ?? '';
	if (name.length > MAX_NAME_LENGTH) {
		name = name.slice(0, MAX_NAME_LENGTH);
		report.namesTruncated++;
	}
	const checked = validateContactMetadata(CONTACT_TYPE, { name });
	if (!checked.ok) throw new Error(`Location version ${row.id}: ${checked.error}`);
	return checked.metadata;
}

/**
 * Finds or creates the address for each prepared version and writes its
 * contact version. Rows arrive grouped by entity, newest version first, so an
 * address takes the newest pin and an unplaceable old version can borrow the
 * address of a newer one.
 */
async function writeBatch(
	client: pg.PoolClient | null,
	orgId: string,
	rows: LocationRow[],
	prepared: (Prepared | null)[],
	reasons: Map<string, string>,
	index: KeyIndex,
	nameless: Map<string, string>,
	report: Report
) {
	const latestAddressOf = new Map<string, string>();

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const item = prepared[i];
		let addressEntityId: string | undefined;

		if (!item) {
			addressEntityId = latestAddressOf.get(row.entity_id);
			if (!addressEntityId) {
				report.skipped.push(`${row.entity_id} (version ${row.id}): ${reasons.get(row.id)}`);
				continue;
			}
			report.addressFromNewerVersion++;
		} else {
			addressEntityId =
				item.keys.length > 0
					? item.keys.map((key) => index.get(key)).find((id): id is string => Boolean(id))
					: nameless.get(namelessKey(item));

			if (addressEntityId) {
				report.addressesMatched++;
			} else {
				addressEntityId = await createAddress(client, orgId, item);
				if (item.keys.length > 0) {
					for (const key of item.keys) if (!index.has(key)) index.set(key, addressEntityId);
				} else {
					nameless.set(namelessKey(item), addressEntityId);
					report.nameAsBuilding.push(
						`${item.parsed.premises_name}${oneLineText(row) ? `, ${oneLineText(row)}` : ''}`
					);
				}
				if (item.parsed.needsReview && item.keys.length > 0) report.needsReview.push(oneLineText(row));
				report.addressesCreated++;
			}
		}
		latestAddressOf.set(row.entity_id, addressEntityId);

		if (client) {
			// Everything but the shape comes straight from the location version, in
			// SQL, so timestamps keep their microseconds.
			await client.query(
				`INSERT INTO universe.org_contact
					(id, org_id, entity_id, type, address_entity_id, metadata, photo_keys,
					 valid_from, valid_to, authored_by, source, created_at)
				 SELECT ol.id, ol.org_id, ol.entity_id, $3, $4, $5, ol.photo_keys,
				        ol.valid_from, ol.valid_to, ol.authored_by, ol.source, ol.created_at
				   FROM universe.org_location ol
				  WHERE ol.id = $1 AND ol.org_id = $2
				 ON CONFLICT (id) DO NOTHING`,
				[row.id, orgId, CONTACT_TYPE, addressEntityId, JSON.stringify(contactMetadata(row, report))]
			);
		} else {
			contactMetadata(row, report);
		}
		report.versionsCopied++;
	}
}

async function createAddress(client: pg.PoolClient | null, orgId: string, item: Prepared): Promise<string> {
	// Dry run: a stand-in id so later versions still match.
	if (!client) return randomUUID();

	const { parsed, row } = item;
	// The address's source says where its pin came from, so geocoded and
	// approximate pins can be found and checked later. Its dates are set from
	// its contacts once the org is done (see backdateAddresses).
	const source = item.pinSource === 'location' ? 'backfill' : `backfill:${item.pinSource}`;
	const { entityId } = await insertAddress(
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
	);
	return entityId;
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

/**
 * Removes the contacts the earlier backfill wrote: one per current location,
 * with a new id and the date of that run. Their addresses stay and are
 * matched into; any left unused are removed by removeOrphanAddresses.
 */
async function removeLegacyContacts(client: pg.PoolClient, orgId: string): Promise<number> {
	const result = await client.query(
		`DELETE FROM universe.org_contact c
		  WHERE c.org_id = $1 AND c.source = $2
		    AND NOT EXISTS (SELECT 1 FROM universe.org_location ol WHERE ol.id = c.id)
		    AND EXISTS (SELECT 1 FROM universe.org_location ol WHERE ol.entity_id = c.entity_id)`,
		[orgId, LEGACY_CONTACT_SOURCE]
	);
	return result.rowCount ?? 0;
}

/** Brings copied versions in line with locations closed (edited or deleted) since the last run. */
async function syncValidTo(client: pg.PoolClient, orgId: string): Promise<number> {
	const result = await client.query(
		`UPDATE universe.org_contact c SET valid_to = ol.valid_to
		   FROM universe.org_location ol
		  WHERE c.id = ol.id AND c.org_id = $1 AND ol.org_id = $1
		    AND c.valid_to IS DISTINCT FROM ol.valid_to`,
		[orgId]
	);
	return result.rowCount ?? 0;
}

/**
 * Dates each backfill address from the earliest contact version that uses it,
 * and credits that version's author, so an address is never younger than its
 * first contact. Backfill addresses have one version each.
 */
async function backdateAddresses(client: pg.PoolClient, orgId: string): Promise<number> {
	const result = await client.query(
		`UPDATE universe.org_address a
		    SET valid_from = first.valid_from, created_at = first.created_at, authored_by = first.authored_by
		   FROM (SELECT DISTINCT ON (address_entity_id)
		                address_entity_id, valid_from, created_at, authored_by
		           FROM universe.org_contact
		          WHERE org_id = $1
		          ORDER BY address_entity_id, valid_from, created_at) first
		  WHERE a.entity_id = first.address_entity_id AND a.org_id = $1
		    AND a.source LIKE 'backfill%'
		    AND (a.valid_from, a.created_at, a.authored_by) IS DISTINCT FROM
		        (first.valid_from, first.created_at, first.authored_by)`,
		[orgId]
	);
	return result.rowCount ?? 0;
}

/** Deletes backfill addresses that no contact version points at (left by the earlier backfill). */
async function removeOrphanAddresses(client: pg.PoolClient, orgId: string): Promise<number> {
	const result = await client.query(
		`DELETE FROM universe.org_entity e
		  WHERE e.org_id = $1
		    AND EXISTS (SELECT 1 FROM universe.org_address a
		                 WHERE a.entity_id = e.id AND a.source LIKE 'backfill%')
		    AND NOT EXISTS (SELECT 1 FROM universe.org_address a
		                     WHERE a.entity_id = e.id AND a.source NOT LIKE 'backfill%')
		    AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.address_entity_id = e.id)
		    AND NOT EXISTS (SELECT 1 FROM universe.org_relationship r
		                     WHERE r.from_org_entity_id = e.id OR r.to_org_entity_id = e.id)`,
		[orgId]
	);
	return result.rowCount ?? 0;
}

interface CheckResult {
	versions: number;
	copied: number;
	missing: number;
	different: number;
}

/**
 * Compares every location version with its contact version: same entity,
 * dates, author, source, and photos, and the name in metadata.
 */
async function check(client: pg.PoolClient, orgId: string): Promise<CheckResult> {
	const result = await client.query<{ versions: string; copied: string; different: string }>(
		`SELECT count(*)::text AS versions,
		        count(c.id)::text AS copied,
		        count(c.id) FILTER (WHERE
		          c.entity_id <> ol.entity_id
		          OR c.valid_from <> ol.valid_from
		          OR c.valid_to IS DISTINCT FROM ol.valid_to
		          OR c.created_at <> ol.created_at
		          OR c.authored_by IS DISTINCT FROM ol.authored_by
		          OR c.source <> ol.source
		          OR c.photo_keys <> ol.photo_keys
		          OR c.metadata->>'name' <> left(coalesce(ol.name, ''), ${MAX_NAME_LENGTH})
		        )::text AS different
		   FROM universe.org_location ol
		   LEFT JOIN universe.org_contact c ON c.id = ol.id AND c.org_id = $1
		  WHERE ol.org_id = $1`,
		[orgId]
	);
	const row = result.rows[0];
	return {
		versions: Number(row.versions),
		copied: Number(row.copied),
		missing: Number(row.versions) - Number(row.copied),
		different: Number(row.different)
	};
}

async function backfillOrg(pool: pg.Pool, orgId: string, orgName: string): Promise<Report> {
	const report: Report = {
		org: orgName,
		versionsCopied: 0,
		legacyContactsReplaced: 0,
		validToSynced: 0,
		addressesCreated: 0,
		addressesMatched: 0,
		addressesBackdated: 0,
		orphanAddressesRemoved: 0,
		countryFromOrg: 0,
		defaultCountry: 0,
		geocoded: 0,
		addressFromNewerVersion: 0,
		namesTruncated: 0,
		approximatePin: [],
		nameAsBuilding: [],
		needsReview: [],
		skipped: [],
		check: null
	};

	// Old contacts out and closed versions closed, before anything is copied:
	// a location has one current contact at most (a unique index).
	const [legacy, synced, remaining] = await inOrg(pool, orgId, APPLY, async (client) => {
		const removed = await removeLegacyContacts(client, orgId);
		const closed = await syncValidTo(client, orgId);
		const count = await client.query<{ versions: string; entities: string }>(
			`SELECT count(*)::text AS versions, count(DISTINCT ol.entity_id)::text AS entities
			   FROM universe.org_location ol
			  WHERE ol.org_id = $1
			    AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.id = ol.id)`,
			[orgId]
		);
		return [removed, closed, count.rows[0]] as const;
	});
	report.legacyContactsReplaced = legacy;
	report.validToSynced = synced;
	console.log(
		`\n${orgName}: ${remaining.versions} location versions (${remaining.entities} locations) to copy` +
			(legacy ? `, ${legacy} contacts from the earlier backfill to replace` : '')
	);

	if (Number(remaining.versions) > 0) {
		const [index, centres] = await inOrg(pool, orgId, false, async (client) => [
			await indexExistingAddresses(client, orgId),
			await loadOrgContext(client, orgId)
		] as const);
		console.log(`  indexed ${new Set(index.values()).size} existing addresses`);
		const nameless = new Map<string, string>();

		// Keyset pagination on the entity id: a dry run writes nothing, so "not yet
		// copied" alone would return the same batch forever. All of an entity's
		// versions are in one batch, newest first.
		let after: string | null = null;
		const started = Date.now();

		for (;;) {
			const batch: LocationRow[] = await inOrg(pool, orgId, false, async (client) => {
				const result = await client.query<LocationRow>(
					`WITH entities AS (
					   SELECT DISTINCT ol.entity_id
					     FROM universe.org_location ol
					    WHERE ol.org_id = $1
					      AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.id = ol.id)
					      AND ($2::uuid IS NULL OR ol.entity_id > $2::uuid)
					    ORDER BY ol.entity_id
					    LIMIT $3
					 )
					 SELECT ol.id, ol.entity_id, ol.name,
					        ol.address_line_1, ol.address_line_2, ol.address_line_3,
					        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
					        ST_Y(ol.coordinates) AS latitude, ST_X(ol.coordinates) AS longitude
					   FROM universe.org_location ol
					   JOIN entities USING (entity_id)
					  WHERE ol.org_id = $1
					    AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.id = ol.id)
					  ORDER BY ol.entity_id, ol.valid_from DESC, ol.created_at DESC, ol.id`,
					[orgId, after, BATCH_SIZE]
				);
				return result.rows;
			});
			if (batch.length === 0) break;
			after = batch[batch.length - 1].entity_id;

			// libpostal and the geocoder run outside the transaction, so a batch holds
			// no locks while waiting on them.
			const reasons = new Map<string, string>();
			const prepared = await prepareBatch(batch, centres, report, reasons);
			if (APPLY) {
				await inOrg(pool, orgId, true, (client) =>
					writeBatch(client, orgId, batch, prepared, reasons, index, nameless, report)
				);
			} else {
				await writeBatch(null, orgId, batch, prepared, reasons, index, nameless, report);
			}

			const seconds = (Date.now() - started) / 1000;
			const done = report.versionsCopied + report.skipped.length;
			console.log(
				`  ${done}/${remaining.versions} versions (${Math.round(done / seconds)}/s, ` +
					`${report.addressesCreated} new addresses, ${report.addressesMatched} matched, ` +
					`${report.geocoded} geocoded)`
			);
		}
	}

	if (APPLY) {
		await inOrg(pool, orgId, true, async (client) => {
			report.addressesBackdated = await backdateAddresses(client, orgId);
			report.orphanAddressesRemoved = await removeOrphanAddresses(client, orgId);
			report.check = await check(client, orgId);
		});
	}

	return report;
}

function print(report: Report) {
	const list = (lines: string[]) => lines.forEach((line) => console.log(`    ${line}`));
	console.log(`\n${report.org}`);
	console.log(`  location versions copied:          ${report.versionsCopied}`);
	console.log(`  earlier backfill contacts replaced: ${report.legacyContactsReplaced}`);
	console.log(`  copied versions closed since last run: ${report.validToSynced}`);
	console.log(`  addresses created:                 ${report.addressesCreated}`);
	console.log(`  existing addresses matched:        ${report.addressesMatched}`);
	console.log(`  addresses dated from first contact: ${report.addressesBackdated}`);
	console.log(`  unused backfill addresses removed: ${report.orphanAddressesRemoved}`);
	console.log(`  country from org's locations:      ${report.countryFromOrg}`);
	console.log(`  default country used:              ${report.defaultCountry}`);
	console.log(`  pins geocoded:                     ${report.geocoded}`);
	console.log(`  old versions given a newer version's address: ${report.addressFromNewerVersion}`);
	console.log(`  names cut to ${MAX_NAME_LENGTH} characters:         ${report.namesTruncated}`);
	console.log(`  approximate pins (area centre): ${report.approximatePin.length}`);
	list([...new Set(report.approximatePin)]);
	console.log(`  name used as building (no street line): ${report.nameAsBuilding.length}`);
	list(report.nameAsBuilding);
	console.log(`  needs review (no building number or name found): ${report.needsReview.length}`);
	list(report.needsReview);
	console.log(`  skipped: ${report.skipped.length}`);
	list(report.skipped);
	if (report.check) {
		const { versions, copied, missing, different } = report.check;
		const ok = missing === 0 && different === 0;
		console.log(
			`  check: ${ok ? 'OK' : 'FAILED'}, ${copied}/${versions} versions copied` +
				(missing ? `, ${missing} missing` : '') +
				(different ? `, ${different} differ from their location version` : '')
		);
	}
}

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	let failed = false;
	try {
		const schema = await pool.query<{ ready: boolean }>(
			`SELECT to_regclass('universe.org_contact') IS NOT NULL AS ready`
		);
		if (!schema.rows[0].ready) {
			throw new Error('universe.org_contact does not exist. Run npm run migrate first.');
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
		for (const org of orgs.rows) {
			const report = await backfillOrg(pool, org.id, org.name);
			print(report);
			if (report.check && (report.check.missing > 0 || report.check.different > 0)) failed = true;
		}
	} finally {
		await pool.end();
	}
	if (failed) {
		console.error('\nSome location versions were not copied exactly. See the checks above.');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
