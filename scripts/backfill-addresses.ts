#!/usr/bin/env tsx
/**
 * Links every location to a structured address (expand step of the address
 * migration, see step 41 in src/lib/server/setup-schema.ts).
 *
 * For each current location that has no located_at relationship yet, the
 * address text is parsed into S42 fields with libpostal, spelling variants of
 * one building are merged into a single address, a unit is added when the
 * location has one, and the location is linked to the unit or the address.
 * Locations already linked are left alone, so the script can be rerun (it is
 * rerun right before the contract step) and new locations join the addresses
 * that already exist.
 *
 * libpostal runs as an HTTP service, not inside the app:
 *   docker run -d -p 4400:4400 pelias/libpostal-service
 *
 * Usage:
 *   tsx scripts/backfill-addresses.ts           # dry run: report, write nothing
 *   tsx scripts/backfill-addresses.ts --apply   # write
 *
 * Env: DATABASE_URL, LIBPOSTAL_URL (default http://localhost:4400)
 */

import pg from 'pg';
import dotenv from 'dotenv';
import {
	addUnit,
	insertAddress,
	linkLocation
} from '../src/lib/server/services/addresses.service.ts';
import {
	buildingText,
	dedupeKeys,
	groupBySharedKey,
	toAddressFields,
	type ParsedAddress,
	type ParsedComponent
} from '../src/lib/shared/utils/address-parse.ts';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIBPOSTAL_URL = (process.env.LIBPOSTAL_URL ?? 'http://localhost:4400').replace(/\/$/, '');
const SOURCE = 'backfill';

async function libpostal<T>(endpoint: 'parse' | 'expand', address: string): Promise<T> {
	const res = await fetch(`${LIBPOSTAL_URL}/${endpoint}?address=${encodeURIComponent(address)}`);
	if (!res.ok) throw new Error(`libpostal ${endpoint} returned ${res.status}`);
	return (await res.json()) as T;
}

interface LocationRow {
	entity_id: string;
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
}

/** A location to link, or an address that already exists and can be matched. */
type Item =
	| { kind: 'location'; row: LocationRow; text: string; parsed: ParsedAddress; keys: string[] }
	| { kind: 'address'; entityId: string; text: string; keys: string[] };

interface Report {
	org: string;
	considered: number;
	skipped: string[];
	needsReview: string[];
	addressesCreated: number;
	addressesMatched: number;
	unitsCreated: number;
	linked: number;
	merged: string[][];
}

async function backfillOrg(client: pg.PoolClient, orgId: string, orgName: string): Promise<Report> {
	const report: Report = {
		org: orgName,
		considered: 0,
		skipped: [],
		needsReview: [],
		addressesCreated: 0,
		addressesMatched: 0,
		unitsCreated: 0,
		linked: 0,
		merged: []
	};

	const locations = await client.query<LocationRow>(
		`SELECT ol.entity_id, ol.address_line_1, ol.address_line_2, ol.address_line_3,
		        ol.city, ol.state_or_region, ol.postal_code, ol.country_code,
		        ST_Y(ol.coordinates) AS latitude, ST_X(ol.coordinates) AS longitude
		   FROM universe.org_location ol
		  WHERE ol.org_id = $1 AND ol.valid_to IS NULL
		    AND NOT EXISTS (
		      SELECT 1 FROM universe.org_relationship r
		        JOIN universe.relationship_type rt ON rt.id = r.relationship_type_id
		       WHERE rt.slug = 'located_at'
		         AND r.org_id = $1
		         AND r.from_org_entity_id = ol.entity_id
		         AND r.valid_to IS NULL
		    )
		  ORDER BY ol.valid_from, ol.id`,
		[orgId]
	);
	report.considered = locations.rows.length;
	if (locations.rows.length === 0) return report;

	const items: Item[] = [];

	// Addresses that already exist, so reruns match into them instead of
	// creating duplicates.
	const existing = await client.query<ExistingAddressRow>(
		`SELECT entity_id, premises_name, premises_number,
		        thoroughfare_name, thoroughfare_type,
		        thoroughfare_pre_qualifier, thoroughfare_post_qualifier,
		        locality, postcode, country_code
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
			unit: null,
			floor: null,
			needsReview: false
		};
		const text = buildingText(parsed);
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

		const expansions = await libpostal<string[]>('expand', buildingText(parsed));
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
			let target = addressEntityId;
			if (member.parsed.unit) {
				target = await findOrAddUnit(client, orgId, addressEntityId, member.parsed, report);
			}
			await linkLocation(client, orgId, member.row.entity_id, target, null, SOURCE);
			report.linked++;
		}
	}

	return report;
}

/** Reuses a live unit with the same type and identifier, or adds one. */
async function findOrAddUnit(
	client: pg.PoolClient,
	orgId: string,
	addressEntityId: string,
	parsed: ParsedAddress,
	report: Report
): Promise<string> {
	const unit = parsed.unit!;
	const found = await client.query<{ entity_id: string }>(
		`SELECT entity_id FROM universe.org_address_unit
		  WHERE org_id = $1 AND address_entity_id = $2 AND deleted_at IS NULL
		    AND lower(coalesce(unit_type, '')) = lower(coalesce($3, ''))
		    AND lower(unit_identifier) = lower($4)`,
		[orgId, addressEntityId, unit.unit_type, unit.unit_identifier]
	);
	if (found.rows[0]) return found.rows[0].entity_id;

	const entityId = await addUnit(client, orgId, addressEntityId, {
		unit_type: unit.unit_type,
		unit_identifier: unit.unit_identifier,
		floor: parsed.floor
	});
	if (!entityId) throw new Error(`Address ${addressEntityId} is not a live address`);
	report.unitsCreated++;
	return entityId;
}

function print(report: Report) {
	console.log(`\n${report.org}`);
	console.log(`  locations to link:  ${report.considered}`);
	console.log(`  linked:             ${report.linked}`);
	console.log(`  addresses created:  ${report.addressesCreated}`);
	console.log(`  existing matched:   ${report.addressesMatched}`);
	console.log(`  units created:      ${report.unitsCreated}`);
	console.log(`  skipped:            ${report.skipped.length}`);
	for (const line of report.skipped) console.log(`    ${line}`);
	console.log(`  needs review (no building number or name found): ${report.needsReview.length}`);
	for (const line of report.needsReview) console.log(`    ${line}`);
	console.log(`  merged groups: ${report.merged.length}`);
	for (const group of report.merged) console.log(`    ${group.join('  |  ')}`);
}

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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
