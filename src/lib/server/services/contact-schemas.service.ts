import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import {
	currentAddressLeftJoin,
	identifierSql,
	line1Sql
} from '$lib/server/services/contact-columns';
import { requireContactSchemaOrg, requireOrgPermission } from '$lib/server/list-access';
import { buildFilterQuery } from '$lib/server/services/filters.service';
import { requirePermission } from '$lib/server/utils/require-permission';
import type {
	ContactSchemaFieldInput,
	CreateContactSchemaInput,
	UpdateContactSchemaInput
} from '$lib/shared/schemas/contact-schemas';
import { clampPage, PAGE_SIZE, pageOffset, type Page } from '$lib/shared/utils/pagination';
import type { AllContact, ContactSchema, SchemaContact } from '$lib/shared/types/contact-schemas';
import type { FilterGroup } from '$lib/shared/types/filters';

/**
 * Contact schemas describe the metadata a contact carries: a list of fields,
 * each with its own id, a name, a type, and whether it is required. A contact
 * keeps each value under the field's id. A schema is "in use" while any contact version
 * names it (`org_contact.schema_id`), and an in-use schema cannot be deleted.
 */

// There are no contact_schema.* permission keys yet, so schemas use the same
// staff check as buckets and surveys.
const PERMISSION = 'system.access';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

const SELECT = `
	SELECT cs.id, cs.org_id, cs.schema_name, cs.identifier_field_id, cs.created_at, cs.updated_at,
	       COALESCE(
	         (SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'type', f.type, 'required', f.required)
	                          ORDER BY f.position)
	          FROM universe.contact_schema_field f
	          WHERE f.schema_id = cs.id AND f.org_id = cs.org_id),
	         '[]'::json
	       ) AS fields,
	       (SELECT count(*)::int FROM universe.org_contact c
	        WHERE c.schema_id = cs.id AND c.org_id = cs.org_id) AS contact_count
	FROM universe.contact_schema cs`;

function isCode(e: unknown, code: string): boolean {
	return (e as { code?: string })?.code === code;
}

const NAME_TAKEN = 'A schema with that name already exists.';
const BAD_IDENTIFIER =
	"The identifier must be one of the schema's text fields. Choose another field, or use the default.";
const FIELD_NAME_TAKEN = 'Field names must be different, whatever their capital letters.';

/** Writes a schema's fields, in the given order. */
async function insertFields(
	client: PoolClient,
	orgId: string,
	schemaId: string,
	fields: ContactSchemaFieldInput[],
	startAt = 0
): Promise<void> {
	for (const [index, field] of fields.entries()) {
		await client.query(
			`INSERT INTO universe.contact_schema_field (id, org_id, schema_id, name, type, required, position)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[field.id, orgId, schemaId, field.name, field.type, field.required, startAt + index]
		);
	}
}

/** The fields with the identifier forced to required, since it always is. */
function withRequiredIdentifier(
	fields: ContactSchemaFieldInput[],
	identifierId: string | null | undefined
): ContactSchemaFieldInput[] {
	return fields.map((f) => (f.id === identifierId ? { ...f, required: true } : f));
}

function inUse(count: number): string {
	return `This schema is used by ${count} ${count === 1 ? 'contact' : 'contacts'}. Remove it from them before deleting it.`;
}

/** The org's contact schemas in the order staff arranged them. 404 unless the caller is a member, 403 without staff access. */
export async function listContactSchemas(userId: string, orgId: string): Promise<ContactSchema[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<ContactSchema>(
			`${SELECT} WHERE cs.org_id = $1 ORDER BY cs.position, cs.schema_name, cs.id`,
			[orgId]
		);
		return result.rows;
	});
}

/** The message for a unique violation: a taken schema name or a repeated field name. */
function uniqueMessage(e: unknown): string {
	const constraint = (e as { constraint?: string })?.constraint ?? '';
	return constraint.includes('field') ? FIELD_NAME_TAKEN : NAME_TAKEN;
}

/** Creates a contact schema with its fields. 409 when the org already has one with that name. */
export async function createContactSchema(
	userId: string,
	orgId: string,
	input: CreateContactSchemaInput
): Promise<ContactSchema> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	try {
		return await withOrgTransaction(orgId, async (client) => {
			const created = await client.query<{ id: string }>(
				`INSERT INTO universe.contact_schema (org_id, schema_name, position)
				 VALUES ($1, $2,
				         (SELECT COALESCE(MAX(position) + 1, 0) FROM universe.contact_schema WHERE org_id = $1))
				 RETURNING id`,
				[orgId, input.schema_name]
			);
			const schemaId = created.rows[0].id;

			await insertFields(
				client,
				orgId,
				schemaId,
				withRequiredIdentifier(input.fields, input.identifier_field_id)
			);
			// After the fields, which the identifier points at.
			if (input.identifier_field_id) {
				await client.query(
					`UPDATE universe.contact_schema SET identifier_field_id = $3 WHERE id = $1 AND org_id = $2`,
					[schemaId, orgId, input.identifier_field_id]
				);
			}

			const result = await client.query<ContactSchema>(
				`${SELECT} WHERE cs.id = $1 AND cs.org_id = $2`,
				[schemaId, orgId]
			);
			return result.rows[0];
		});
	} catch (e) {
		if (isCode(e, UNIQUE_VIOLATION)) throw error(409, uniqueMessage(e));
		if (isCode(e, CHECK_VIOLATION)) throw error(400, BAD_IDENTIFIER);
		throw e;
	}
}

/** One contact schema. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function getContactSchema(userId: string, schemaId: string): Promise<ContactSchema> {
	const orgId = await requireContactSchemaOrg(userId, schemaId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, PERMISSION);

		const result = await client.query<ContactSchema>(
			`${SELECT} WHERE cs.id = $1 AND cs.org_id = $2`,
			[schemaId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Contact schema not found');
		return result.rows[0];
	});
}

/**
 * Changes the given parts of a schema and leaves the rest as they are. When
 * `fields` is sent it is the full list: a field whose id exists is updated
 * (renamed, retyped, or made required or optional), one with a new id is added,
 * and one not listed is removed. 409 when the name is taken, or when a field of
 * a schema that contacts use would change type; 400 when the identifier is not a
 * required text field.
 */
export async function updateContactSchema(
	userId: string,
	schemaId: string,
	input: UpdateContactSchemaInput
): Promise<ContactSchema> {
	const orgId = await requireContactSchemaOrg(userId, schemaId);

	try {
		return await withOrgTransaction(orgId, async (client) => {
			await requirePermission(client, userId, orgId, PERMISSION);

			// Locked so two edits of one schema cannot interleave.
			const locked = await client.query<{ identifier_field_id: string | null }>(
				`SELECT identifier_field_id FROM universe.contact_schema
				 WHERE id = $1 AND org_id = $2 FOR UPDATE`,
				[schemaId, orgId]
			);
			if (locked.rowCount === 0) throw error(404, 'Contact schema not found');

			if (input.schema_name !== undefined) {
				await client.query(
					`UPDATE universe.contact_schema SET schema_name = $3, updated_at = now()
					 WHERE id = $1 AND org_id = $2`,
					[schemaId, orgId, input.schema_name]
				);
			}

			// The identifier after the change: the one sent, else the one it has.
			const identifierId =
				input.identifier_field_id !== undefined
					? input.identifier_field_id
					: locked.rows[0].identifier_field_id;

			if (input.fields !== undefined) {
				await replaceFields(
					client,
					orgId,
					schemaId,
					withRequiredIdentifier(input.fields, identifierId),
					input.identifier_field_id
				);
			} else if (input.identifier_field_id !== undefined) {
				await client.query(
					`UPDATE universe.contact_schema SET identifier_field_id = $3, updated_at = now()
					 WHERE id = $1 AND org_id = $2`,
					[schemaId, orgId, input.identifier_field_id]
				);
				// The identifier is always required.
				if (input.identifier_field_id) {
					await client.query(
						`UPDATE universe.contact_schema_field SET required = true
						 WHERE id = $1 AND schema_id = $2 AND org_id = $3`,
						[input.identifier_field_id, schemaId, orgId]
					);
				}
			}
			if (input.fields !== undefined) {
				await client.query(
					`UPDATE universe.contact_schema SET updated_at = now() WHERE id = $1 AND org_id = $2`,
					[schemaId, orgId]
				);
			}

			const result = await client.query<ContactSchema>(
				`${SELECT} WHERE cs.id = $1 AND cs.org_id = $2`,
				[schemaId, orgId]
			);
			return result.rows[0];
		});
	} catch (e) {
		if (isCode(e, UNIQUE_VIOLATION)) throw error(409, uniqueMessage(e));
		// The identifier is not a required text field of the schema.
		if (isCode(e, CHECK_VIOLATION) || isCode(e, FOREIGN_KEY_VIOLATION)) {
			throw error(400, BAD_IDENTIFIER);
		}
		throw e;
	}
}

/**
 * Makes the schema's fields exactly `fields`: updates the ones that exist,
 * adds the new ones, removes the rest, and points the identifier at
 * `identifierId` when it was sent. Field types cannot change once a contact
 * uses the schema, since its stored values would no longer fit.
 */
async function replaceFields(
	client: PoolClient,
	orgId: string,
	schemaId: string,
	fields: ContactSchemaFieldInput[],
	newIdentifierId: string | null | undefined
): Promise<void> {
	const existing = await client.query<{ id: string; type: string }>(
		`SELECT id, type FROM universe.contact_schema_field WHERE schema_id = $1 AND org_id = $2`,
		[schemaId, orgId]
	);
	const known = new Map(existing.rows.map((r) => [r.id, r.type]));
	const keep = new Set(fields.map((f) => f.id));

	const used = await client.query<{ count: number }>(
		`SELECT count(*)::int AS count FROM universe.org_contact WHERE schema_id = $1 AND org_id = $2`,
		[schemaId, orgId]
	);
	if (used.rows[0].count > 0) {
		const retyped = fields.find((f) => known.has(f.id) && known.get(f.id) !== f.type);
		if (retyped) {
			throw error(
				409,
				`"${retyped.name}" changes type, but contacts already use this schema. Their values would no longer fit.`
			);
		}
	}

	// A removed field cannot stay the identifier.
	await client.query(
		`UPDATE universe.contact_schema SET identifier_field_id = NULL
		 WHERE id = $1 AND org_id = $2 AND identifier_field_id IS NOT NULL
		   AND NOT (identifier_field_id = ANY($3::uuid[]))`,
		[schemaId, orgId, [...keep]]
	);

	const removed = [...known.keys()].filter((id) => !keep.has(id));
	if (removed.length > 0) {
		await client.query(
			`DELETE FROM universe.contact_schema_field
			 WHERE schema_id = $1 AND org_id = $2 AND id = ANY($3::uuid[])`,
			[schemaId, orgId, removed]
		);
	}

	// Names are unique, so names that swap between fields are first set aside.
	await client.query(
		`UPDATE universe.contact_schema_field SET name = id::text
		 WHERE schema_id = $1 AND org_id = $2 AND id = ANY($3::uuid[])`,
		[schemaId, orgId, fields.filter((f) => known.has(f.id)).map((f) => f.id)]
	);
	for (const [index, field] of fields.entries()) {
		if (known.has(field.id)) {
			await client.query(
				`UPDATE universe.contact_schema_field
				 SET name = $4, type = $5, required = $6, position = $7
				 WHERE id = $1 AND schema_id = $2 AND org_id = $3`,
				[field.id, schemaId, orgId, field.name, field.type, field.required, index]
			);
		} else {
			await insertFields(client, orgId, schemaId, [field], index);
		}
	}

	if (newIdentifierId !== undefined) {
		await client.query(
			`UPDATE universe.contact_schema SET identifier_field_id = $3 WHERE id = $1 AND org_id = $2`,
			[schemaId, orgId, newIdentifierId]
		);
	}
}

/** Deletes a contact schema. 409 while any contact names it. */
export async function deleteContactSchema(userId: string, schemaId: string): Promise<void> {
	const orgId = await requireContactSchemaOrg(userId, schemaId);

	try {
		await withOrgTransaction(orgId, async (client) => {
			await requirePermission(client, userId, orgId, PERMISSION);

			// Locked so a contact cannot start using it between the count and the delete.
			const schema = await client.query(
				`SELECT 1 FROM universe.contact_schema WHERE id = $1 AND org_id = $2 FOR UPDATE`,
				[schemaId, orgId]
			);
			if (schema.rowCount === 0) throw error(404, 'Contact schema not found');

			const used = await client.query<{ count: number }>(
				`SELECT count(*)::int AS count FROM universe.org_contact
				 WHERE schema_id = $1 AND org_id = $2`,
				[schemaId, orgId]
			);
			if (used.rows[0].count > 0) throw error(409, inUse(used.rows[0].count));

			await client.query(`DELETE FROM universe.contact_schema WHERE id = $1 AND org_id = $2`, [
				schemaId,
				orgId
			]);
		});
	} catch (e) {
		// A contact that named it after the count; the database refuses the delete.
		if (isCode(e, FOREIGN_KEY_VIOLATION)) throw error(409, 'This schema is used by a contact.');
		throw e;
	}
}

/** What narrows a list of contacts, besides which schema it is for. */
export interface ContactListOptions {
	/** Text a contact's identifier or any of its values must contain, ignoring case. */
	search?: string | null;
	/** The filter editor's document. An empty group, or none, keeps every contact. */
	filters?: FilterGroup | null;
}

/** Longest search text used; more is cut off rather than refused. */
export const MAX_SEARCH_LENGTH = 200;

/** The joins every contact list reads, so search can see the identifier and the address. */
const CONTACT_FROM = `
	FROM universe.org_contact c
	LEFT JOIN universe.contact_schema cs ON cs.id = c.schema_id AND cs.org_id = c.org_id
	${currentAddressLeftJoin('c', 'a')}`;

/** Makes LIKE wildcards in typed text match literally. */
function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

/**
 * The WHERE clause and parameters for the current contacts of an org, narrowed
 * to a schema, a search, and filters. The caller adds its own placeholders with
 * `param()`, which continues the numbering. The filters are compiled by the same
 * code that builds buckets, then used as a subquery on the current contact
 * versions.
 */
function contactWhere(
	orgId: string,
	schemaId: string | null,
	options: ContactListOptions
): { where: string; params: unknown[]; param: (value: unknown) => string } {
	const params: unknown[] = [];
	const conditions: string[] = [];

	// The filter query goes first because its placeholders are numbered from $1.
	const filters = options.filters;
	let filterCondition: string | null = null;
	if (filters && filters.filters.length > 0) {
		const compiled = buildFilterQuery('locations', filters, { orgId, columns: ['id'] });
		params.push(...compiled.params);
		filterCondition = `c.id IN (${compiled.sql})`;
	}

	const param = (value: unknown) => `$${params.push(value)}`;

	conditions.push(`c.org_id = ${param(orgId)}`, 'c.valid_to IS NULL');
	if (filterCondition) conditions.push(filterCondition);
	if (schemaId) conditions.push(`c.schema_id = ${param(schemaId)}::uuid`);

	const search = options.search?.trim().slice(0, MAX_SEARCH_LENGTH);
	if (search) {
		const like = param(`%${escapeLike(search)}%`);
		// Values only: the keys are field ids, which a person never types.
		conditions.push(
			`(${identifierSql('c', 'cs', 'a')} ILIKE ${like}
			  OR EXISTS (SELECT 1 FROM jsonb_each_text(c.metadata) AS kv WHERE kv.value ILIKE ${like}))`
		);
	}

	return { where: conditions.join(' AND '), params, param };
}

/**
 * One page of the current contacts that use a schema, newest first. 404 when
 * the schema is in none of the caller's orgs, 403 without staff access.
 */
export async function listSchemaContacts(
	userId: string,
	schemaId: string,
	requested: number,
	options: ContactListOptions = {}
): Promise<Page<SchemaContact>> {
	const orgId = await requireContactSchemaOrg(userId, schemaId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, PERMISSION);

		const { where, params, param } = contactWhere(orgId, schemaId, options);
		const count = await client.query<{ count: number }>(
			`SELECT count(*)::int AS count ${CONTACT_FROM} WHERE ${where}`,
			params
		);
		const totalCount = count.rows[0].count;
		const page = clampPage(requested, totalCount);

		// The id tiebreak makes the order total, so pages cannot repeat or skip a row.
		const rows = await client.query<SchemaContact>(
			`SELECT c.entity_id AS id, c.metadata, ${identifierSql('c', 'cs', 'a')} AS identifier
			 ${CONTACT_FROM}
			 WHERE ${where}
			 ORDER BY c.valid_from DESC, c.id
			 LIMIT ${param(PAGE_SIZE)} OFFSET ${param(pageOffset(page))}`,
			params
		);

		return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
	});
}

/**
 * Puts the org's contact schemas in the given order. `ids` must name every
 * schema of the org exactly once. 409 when it does not, which means a schema
 * was added or deleted since the caller loaded the list.
 */
export async function reorderContactSchemas(
	userId: string,
	orgId: string,
	ids: string[]
): Promise<void> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	await withOrgTransaction(orgId, async (client) => {
		// Locked so a schema added or deleted meanwhile cannot slip past the comparison.
		const current = await client.query<{ id: string }>(
			`SELECT id FROM universe.contact_schema WHERE org_id = $1 FOR UPDATE`,
			[orgId]
		);
		const known = new Set(current.rows.map((r) => r.id));
		if (
			ids.length !== known.size ||
			new Set(ids).size !== ids.length ||
			!ids.every((id) => known.has(id))
		) {
			throw error(409, 'The list of schemas changed. Reload the page and try again.');
		}

		await client.query(
			`UPDATE universe.contact_schema cs
			 SET position = ordered.position::integer - 1
			 FROM unnest($2::uuid[]) WITH ORDINALITY AS ordered(id, position)
			 WHERE cs.id = ordered.id AND cs.org_id = $1`,
			[orgId, ids]
		);
	});
}

/**
 * One page of every current contact in the org, newest first, with the name of
 * its schema when it has one. 404 unless the caller is a member, 403 without
 * staff access.
 */
export async function listAllContacts(
	userId: string,
	orgId: string,
	requested: number,
	options: ContactListOptions = {}
): Promise<Page<AllContact>> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const { where, params, param } = contactWhere(orgId, null, options);
		const count = await client.query<{ count: number }>(
			`SELECT count(*)::int AS count ${CONTACT_FROM} WHERE ${where}`,
			params
		);
		const totalCount = count.rows[0].count;
		const page = clampPage(requested, totalCount);

		const rows = await client.query<AllContact>(
			`SELECT c.entity_id AS id, c.metadata, c.schema_id, cs.schema_name,
			        ${identifierSql('c', 'cs', 'a')} AS identifier
			 ${CONTACT_FROM}
			 WHERE ${where}
			 ORDER BY c.valid_from DESC, c.id
			 LIMIT ${param(PAGE_SIZE)} OFFSET ${param(pageOffset(page))}`,
			params
		);

		return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
	});
}

/**
 * Ceiling on pins for one map. Past this the map shows the newest contacts, so
 * a large import cannot be serialized into the browser at once.
 */
export const MAX_CONTACT_MARKERS = 5000;

/** A contact with an address on the map, in the shape the map component takes. */
export interface ContactMarker {
	/** The contact's entity id. */
	id: string;
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	latitude: number;
	longitude: number;
}

/**
 * Pins for the org's current contacts that have a position, newest first, for
 * the contacts map. `schemaId` limits them to one schema; null is every
 * contact. 404 unless the caller is a member, 403 without staff access.
 */
export async function listContactMarkers(
	userId: string,
	orgId: string,
	schemaId: string | null,
	options: ContactListOptions = {}
): Promise<ContactMarker[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const { where, params, param } = contactWhere(orgId, schemaId, options);
		const result = await client.query<ContactMarker>(
			`SELECT c.entity_id AS id,
			        ${identifierSql('c', 'cs', 'a')} AS name,
			        ${line1Sql('a')} AS address_line_1,
			        a.locality AS city,
			        ST_Y(a.coordinates) AS latitude,
			        ST_X(a.coordinates) AS longitude
			 ${CONTACT_FROM}
			 WHERE ${where} AND a.coordinates IS NOT NULL
			 ORDER BY c.valid_from DESC, c.id
			 LIMIT ${param(MAX_CONTACT_MARKERS)}`,
			params
		);
		return result.rows;
	});
}
