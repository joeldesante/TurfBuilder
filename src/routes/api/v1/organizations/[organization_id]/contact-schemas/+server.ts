import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import {
	createContactSchema,
	listContactSchemas
} from '$lib/server/services/contact-schemas.service';
import { createContactSchemaSchema } from '$lib/shared/schemas/contact-schemas';

/**
 * The organization's contact schemas by name, each with how many contacts use it.
 *
 * @auth staff
 * @returns `Array<{ id, org_id, schema_name, fields, identifier_field_id, contact_count, created_at, updated_at }>`. `fields` is the ordered list of `{ id, name, type, required }`, with `type` one of `text`, `boolean`, or `number`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listContactSchemas(userId, orgId));
};

/**
 * Creates a contact schema with its fields.
 *
 * @auth staff
 * @body schema_name {string} - Display name, unique within the organization
 * @body fields {object[]} - The fields, in order: `{ id, name, type, required }`. The id is a new uuid made by the caller. Names must differ, whatever their capital letters
 * @body identifier_field_id {string|null} - Optional. The id of a text field in `fields` that labels a contact; it is always required. Null or left out uses the full address
 * @returns 201 with the schema. 400 for an invalid body, 401 when signed out, 403 without staff access, 404 when the caller is not a member, 409 for a taken name
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const body = await parseBody(request, createContactSchemaSchema);

	return json(await createContactSchema(userId, orgId, body), { status: 201 });
};
