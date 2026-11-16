'use strict';

const { randomUUID } = require('node:crypto');
const { blank, streetFields, unitFields } = require('./address');

/** The contact kind every imported contact gets. The schema's fields are what describe it. */
const CONTACT_TYPE = 'business';

/** Used when a row names no country and the organization has no addresses yet. */
const FALLBACK_COUNTRY = 'US';

const CONTACT_DATA = 'contact.';

const BOOLEAN_TRUE = new Set(['true', 't', 'yes', 'y', '1']);
const BOOLEAN_FALSE = new Set(['false', 'f', 'no', 'n', '0']);

/** The country new addresses get when a row names none: the commonest among the org's addresses. */
async function defaultCountry(client, orgId) {
	const result = await client.query(
		`SELECT country_code FROM universe.org_address
		  WHERE org_id = $1 AND valid_to IS NULL
		  GROUP BY country_code ORDER BY count(*) DESC, country_code LIMIT 1`,
		[orgId]
	);
	return result.rows[0]?.country_code ?? FALLBACK_COUNTRY;
}

/** The schema's fields, in the order staff arranged them. */
async function loadFields(client, orgId, schemaId) {
	const result = await client.query(
		`SELECT id, type, required FROM universe.contact_schema_field
		  WHERE schema_id = $1 AND org_id = $2 ORDER BY position`,
		[schemaId, orgId]
	);
	return result.rows;
}

/** A cell as a typed value: undefined for blank, null when it does not fit the type. */
function typed(raw, type) {
	const text = blank(raw);
	if (text === null) return undefined;
	if (type === 'number') {
		const n = Number(text);
		return Number.isFinite(n) ? n : null;
	}
	if (type === 'boolean') {
		const lower = text.toLowerCase();
		if (BOOLEAN_TRUE.has(lower)) return true;
		if (BOOLEAN_FALSE.has(lower)) return false;
		return null;
	}
	return text;
}

/** The place a row is, or null when its coordinates are missing or not on the map. */
function point(cell) {
	const latitude = typed(cell('latitude'), 'number');
	const longitude = typed(cell('longitude'), 'number');
	if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
	if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
	return { latitude, longitude };
}

/**
 * One row as a contact at an address, or null when it cannot be imported: no usable
 * coordinates, or a required field of the schema that is blank or does not fit its type.
 */
function prepare(row, job, country) {
	const column = (key) => job.mapping[`${CONTACT_DATA}${key}`];
	const cell = (key) => (column(key) === undefined ? undefined : row[column(key)]);

	const where = point(cell);
	if (!where) return null;

	const metadata = {};
	for (const field of job.fields) {
		const index = job.mapping[field.id];
		const value = index === undefined ? undefined : typed(row[index], field.type);
		if (value === null || (value === undefined && field.required)) return null;
		if (value !== undefined) metadata[field.id] = value;
	}

	const line1 = blank(cell('address_line_1'));
	const line2 = blank(cell('address_line_2'));
	const city = blank(cell('city'));
	const region = blank(cell('state_or_region'));
	const postcode = blank(cell('postal_code'));
	const countryCode = (blank(cell('country_code')) ?? country).toUpperCase();
	if (!/^[A-Z]{2}$/.test(countryCode)) return null;

	const address = {
		...streetFields(line1, null),
		...unitFields(line2),
		dependent_locality: null,
		locality: city,
		region,
		postcode,
		country_code: countryCode,
		floor: null,
		...where
	};
	// People at the same address share one address. Spelling and case differences do not make a new one.
	const key = [line1, line2, city, region, postcode, countryCode]
		.map((part) => (part ?? '').toLowerCase().replace(/\s+/g, ' '))
		.join('|');

	return { key, address, metadata };
}

const ADDRESS_COLUMNS = [
	'premises_name', 'premises_number', 'thoroughfare_name', 'thoroughfare_type',
	'thoroughfare_pre_qualifier', 'thoroughfare_post_qualifier', 'dependent_locality', 'locality',
	'region', 'postcode', 'country_code', 'unit_type', 'unit_identifier', 'floor'
];

/**
 * Writes one batch of rows inside the transaction it is given: the addresses the rows are at
 * (reusing ones an earlier row or import made), then a contact for each row. Rows are arrays
 * of cells, and job.mapping says which cell fills which field. Returns how many rows were
 * left out because they could not be imported.
 */
async function importBatch(client, orgId, rows, job) {
	job.country ??= await defaultCountry(client, orgId);
	job.fields ??= await loadFields(client, orgId, job.schemaId);

	const prepared = [];
	for (const row of rows) {
		const item = prepare(row, job, job.country);
		if (item) prepared.push(item);
	}
	const skipped = rows.length - prepared.length;
	if (prepared.length === 0) return skipped;

	// Which addresses already exist. source_ref is indexed, so this stays quick on a big org.
	const refOf = (key) => `csv-import:${key}`;
	const keys = [...new Set(prepared.map((item) => item.key))];
	const existing = await client.query(
		`SELECT e.id, e.source_ref FROM universe.org_entity e
		  WHERE e.org_id = $1 AND e.source_ref = ANY($2::text[])
		    AND EXISTS (SELECT 1 FROM universe.org_address a
		                 WHERE a.entity_id = e.id AND a.org_id = $1 AND a.valid_to IS NULL)`,
		[orgId, keys.map(refOf)]
	);
	const addressIdOf = new Map(existing.rows.map((r) => [r.source_ref, r.id]));

	const created = [];
	for (const key of keys) {
		if (addressIdOf.has(refOf(key))) continue;
		const id = randomUUID();
		addressIdOf.set(refOf(key), id);
		created.push({ id, key, address: prepared.find((item) => item.key === key).address });
	}

	const contacts = prepared.map((item) => ({
		id: randomUUID(),
		addressId: addressIdOf.get(refOf(item.key)),
		metadata: JSON.stringify(item.metadata)
	}));
	const source = `csv-import:${job.id}`;

	// Every identity first: addresses (carrying their reuse key) and contacts.
	await client.query(
		`INSERT INTO universe.org_entity (id, org_id, source_ref)
		 SELECT t.id, $1::uuid, t.source_ref
		   FROM unnest($2::uuid[], $3::text[]) AS t(id, source_ref)`,
		[
			orgId,
			[...created.map((a) => a.id), ...contacts.map((c) => c.id)],
			[...created.map((a) => refOf(a.key)), ...contacts.map(() => null)]
		]
	);

	if (created.length > 0) {
		const column = (name) => created.map((a) => a.address[name]);
		await client.query(
			`INSERT INTO universe.org_address
			   (org_id, entity_id, ${ADDRESS_COLUMNS.join(', ')}, coordinates, authored_by, source)
			 SELECT $1::uuid, t.entity_id, ${ADDRESS_COLUMNS.map((c) => `t.${c}`).join(', ')},
			        ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326), $2::uuid, $3::text
			   FROM unnest($4::uuid[], ${ADDRESS_COLUMNS.map((_, i) => `$${i + 5}::text[]`).join(', ')},
			               $${ADDRESS_COLUMNS.length + 5}::float8[], $${ADDRESS_COLUMNS.length + 6}::float8[])
			        AS t(entity_id, ${ADDRESS_COLUMNS.join(', ')}, longitude, latitude)`,
			[
				orgId,
				job.createdBy,
				source,
				created.map((a) => a.id),
				...ADDRESS_COLUMNS.map(column),
				column('longitude'),
				column('latitude')
			]
		);
	}

	await client.query(
		`INSERT INTO universe.org_contact
		   (org_id, entity_id, type, address_entity_id, metadata, schema_id, authored_by, source)
		 SELECT $1::uuid, t.entity_id, $2::text, t.address_entity_id, t.metadata::jsonb,
		        $3::uuid, $4::uuid, $5::text
		   FROM unnest($6::uuid[], $7::uuid[], $8::text[]) AS t(entity_id, address_entity_id, metadata)`,
		[
			orgId,
			CONTACT_TYPE,
			job.schemaId,
			job.createdBy,
			source,
			contacts.map((c) => c.id),
			contacts.map((c) => c.addressId),
			contacts.map((c) => c.metadata)
		]
	);

	return skipped;
}

module.exports = { importBatch, prepare, FALLBACK_COUNTRY };
