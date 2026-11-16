import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import {
	deleteContactSchema,
	getContactSchema,
	updateContactSchema
} from '$lib/server/services/contact-schemas.service';
import { updateContactSchemaSchema } from '$lib/shared/schemas/contact-schemas';

/**
 * One contact schema.
 *
 * @auth staff
 * @returns `{ id, org_id, schema_name, fields, identifier_field_id, contact_count, created_at, updated_at }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);

	return json(await getContactSchema(userId, parseId(params.contact_schema_id, 'contact schema')));
};

/**
 * Changes a contact schema's name, its fields, its identifier, or any of them. When `fields` is sent it is the full list: a field whose id exists is updated (so a rename keeps its id and every value and filter that uses it), a new id adds a field, and an id left out removes the field.
 *
 * @auth staff
 * @body schema_name {string} - Optional. Display name, unique within the organization
 * @body fields {object[]} - Optional. The full list of `{ id, name, type, required }`
 * @body identifier_field_id {string|null} - Optional. A text field that labels a contact, which becomes required. Null goes back to the full address
 * @returns The schema. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 for a taken name or for a field changing type once contacts use the schema
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const schemaId = parseId(params.contact_schema_id, 'contact schema');
	const body = await parseBody(request, updateContactSchemaSchema);

	return json(await updateContactSchema(userId, schemaId, body));
};

/**
 * Deletes a contact schema that no contact uses.
 *
 * @auth staff
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 while any contact uses it
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await deleteContactSchema(userId, parseId(params.contact_schema_id, 'contact schema'));

	return new Response(null, { status: 204 });
};
