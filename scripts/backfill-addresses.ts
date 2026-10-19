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
 * Locations that already have a contact are left alone, so the script can be
 * rerun (it is rerun right before the contract step).
 *
 * libpostal is only contacted when a location needs moving. It runs as an
 * HTTP service and holds about 2 GB in memory, so cap it:
 *   docker run -d --name libpostal --memory 3g -p 4400:4400 pelias/libpostal-service
 *
 * Usage:
 *   tsx scripts/backfill-addresses.ts           # dry run: report, write nothing
 *   tsx scripts/backfill-addresses.ts --apply   # write
 *
 * Env: DATABASE_URL, LIBPOSTAL_URL (default http://localhost:4400)
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { insertAddress } from '$lib/server/services/addresses.service';
import { insertContact } from '$lib/server/services/contacts.service';
import {
	addressText,
	dedupeKeys,
	groupBySharedKey,
	toAddressFields,
	type ParsedAddress,
	type ParsedComponent
} from '$lib/shared/utils/address-parse';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIBPOSTAL_URL = (process.env.LIBPOSTAL_URL ?? 'http://localhost:4400').replace(/\/$/, '');
const SOURCE = 'backfill';
const CONTACT_TYPE = 'business';

async function libpostal<T>(endpoint: 'parse' | 'expand', address: string): Promise<T> {
	const res = await fetch(`${LIBPOSTAL_URL}/${endpoint}?address=${encodeURIComponent(address)}`);
	if (!res.ok) throw new Error(`libpostal ${endpoint} returned ${res.status}`);
	return (await res.json()) as T;
}

interface LocationRow {
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

/** A location to move, or an address that already exists and can be matched. */
type Item =
	| { kind: 'location'; row: LocationRow; text: string; parsed: ParsedAddress; keys: string[] }
	| { kind: 'address'; entityId: string; text: string; keys: string[] };

interface Report {
	org: string;
	parsed: number;
	skipped: string[];
	needsReview: string[];
	addressesCreated: number;
	addressesMatched: number;
	merged: string[][];
}

async function backfillOrg(client: pg.PoolClient, orgId: string, orgName: string): Promise<Report> {
	const report: Report = {
		org: orgName,
		parsed: 0,
		skipped: [],
		needsReview: [],
		addressesCreated: 0,
		addressesMatched: 0,
		merged: []
	};

	const locations = await client.query<LocationRow>(
		`SELECT ol.entity_id, ol.name, ol.photo_keys,
		        ol.address_line_1, ol.address_line_2, ol.address_line_3,
		        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
		        ST_Y(ol.coordinates) AS latitude, ST_X(ol.coordinates) AS longitude
		   FROM universe.org_location ol
		  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
		    AND NOT EXISTS (
		      SELECT 1 FROM universe.org_contact c
		       WHERE c.entity_id = ol.entity_id AND c.org_id = $1 AND c.valid_to IS NULL
		    )
		  ORDER BY ol.valid_from, ol.id`,
		[orgId]
	);
	report.parsed = locations.rows.length;
	// Nothing left to parse, so libpostal is never contacted.
	if (locations.rows.length === 0) return report;

	const items: Item[] = [];

	// Addresses that already exist, so reruns match into them instead of
	// creating duplicates.
	const existing = await client.query<ExistingAddressRow>(
		`SELECT entity_id, premises_name, premises_number,
		        thoroughfare_name, thoroughfare_type,
		        thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
		        locality, postcode, country_code, unit_type, unit_identifier
		   FROM universe.org_address
		  WHERE org_id = $1 AND valid_to IS NULL`,
		[orgId]
	);
	for (const a of existing.rows) {
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
			unit: a.unit_identifier
				? { unit_type: a.unit_type, unit_identifier: a.unit_identifier }
				: null,
			floor: null,
			needsReview: false
		};
		const text = addressText(parsed);
		const expansions = await libpostal<string[]>('expand', text);
		items.push({
			kind: 'address',
			entityId: a.entity_id,
			text,
			keys: dedupeKeys(expansions, parsed, a.country_code)
		});
	}

	for (const row of locations.rows) {
		if (!row.address_line_1?.trim() || !row.country_code || row.latitude === null) {
			report.skipped.push(`${row.entity_id}: missing line 1, country, or coordinates`);
			continue;
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
		const parsed = toAddressFields(components, text, row.address_line_1);
		if (parsed.needsReview) report.needsReview.push(text);

		const expansions = await libpostal<string[]>('expand', addressText(parsed));
		items.push({
			kind: 'location',
			row,
			text,
			parsed,
			keys: dedupeKeys(expansions, parsed, row.country_code.toUpperCase())
		});
	}

	for (const group of groupBySharedKey(items, (item) => item.keys)) {
		const members = group.filter((item) => item.kind === 'location');
		if (members.length === 0) continue;

		const match = group.find((item) => item.kind === 'address');
		let addressEntityId: string;
		if (match) {
			addressEntityId = match.entityId;
			report.addressesMatched++;
		} else {
			// The earliest location in the group sets the address's fields and pin.
			const first = members[0];
			const { entityId } = await insertAddress(
				client,
				orgId,
				{
					premises_name: first.parsed.premises_name,
					premises_number: first.parsed.premises_number,
					thoroughfare_name: first.parsed.thoroughfare_name,
					thoroughfare_type: first.parsed.thoroughfare_type,
					thoroughfare_pre_qualifier: first.parsed.thoroughfare_pre_qualifier,
					thoroughfare_post_qualifier: first.parsed.thoroughfare_post_qualifier,
					dependent_locality: first.parsed.dependent_locality,
					locality: first.parsed.locality ?? first.row.city,
					region: first.parsed.region ?? first.row.state_or_region,
					postcode: first.parsed.postcode ?? first.row.postal_code,
					country_code: first.row.country_code!.toUpperCase(),
					unit_type: first.parsed.unit?.unit_type ?? null,
					unit_identifier: first.parsed.unit?.unit_identifier ?? null,
					floor: first.parsed.floor,
					latitude: first.row.latitude!,
					longitude: first.row.longitude!
				},
				null,
				SOURCE
			);
			addressEntityId = entityId;
			report.addressesCreated++;
		}
		if (group.length > 1) report.merged.push(group.map((item) => item.text));

		for (const member of members) {
			await insertContact(
				client,
				orgId,
				{
					type: CONTACT_TYPE,
					addressEntityId,
					metadata: { name: member.row.name ?? '' },
					photoKeys: member.row.photo_keys
				},
				null,
				SOURCE,
				member.row.entity_id
			);
		}
	}

	return report;
}

function print(report: Report) {
	console.log(`\n${report.org}`);
	console.log(`  locations moved:              ${report.parsed}`);
	console.log(`  addresses created:            ${report.addressesCreated}`);
	console.log(`  existing addresses matched:   ${report.addressesMatched}`);
	console.log(`  skipped:                      ${report.skipped.length}`);
	for (const line of report.skipped) console.log(`    ${line}`);
	console.log(`  needs review (no building number or name found): ${report.needsReview.length}`);
	for (const line of report.needsReview) console.log(`    ${line}`);
	console.log(`  merged groups: ${report.merged.length}`);
	for (const group of report.merged) console.log(`    ${group.join('  |  ')}`);
}

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
	try {
		const orgs = await pool.query<{ id: string; name: string }>(
			`SELECT id, name FROM auth.organization ORDER BY name`
		);
		console.log(APPLY ? 'Applying.' : 'Dry run: nothing will be written. Pass --apply to write.');

		for (const org of orgs.rows) {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [org.id]);
				print(await backfillOrg(client, org.id, org.name));
				await client.query(APPLY ? 'COMMIT' : 'ROLLBACK');
			} catch (err) {
				await client.query('ROLLBACK');
				throw err;
			} finally {
				client.release();
			}
		}
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
