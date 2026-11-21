import { z } from 'zod';
import { CONTACT_SCHEMA_FIELD_TYPES } from '$lib/shared/types/contact-schemas';

const schemaName = z
	.string()
	.trim()
	.min(1, 'Enter a name for the schema.')
	.max(255, 'Name must be 255 characters or fewer.');

const fieldName = z
	.string()
	.min(1, 'Every field needs a name.')
	.max(100, 'Field names must be 100 characters or fewer.')
	.refine((name) => name === name.trim(), 'Field names cannot start or end with a space.');

/**
 * One field of a schema. The id is the field's identity: send the id of an
 * existing field to rename or change it, or a new uuid (made by the caller) to
 * add one. Values are stored under the id, so it must never change.
 */
export const contactSchemaFieldSchema = z.object({
	id: z.uuid(),
	name: fieldName,
	type: z.enum(CONTACT_SCHEMA_FIELD_TYPES, 'Choose Text, True/False, or Number.'),
	required: z.boolean()
});

/** The full list of a schema's fields: ids and names each used once, names compared without regard to case. */
export const contactSchemaFieldsSchema = z
	.array(contactSchemaFieldSchema)
	.max(200, 'A schema can have at most 200 fields.')
	.superRefine((fields, ctx) => {
		const ids = new Set<string>();
		const names = new Set<string>();
		for (const [index, field] of fields.entries()) {
			if (ids.has(field.id)) {
				ctx.addIssue({ code: 'custom', message: 'A field is listed twice.', path: [index, 'id'] });
			}
			ids.add(field.id);

			// "Name" and "name" are the same field to a person.
			const key = field.name.toLowerCase();
			if (names.has(key)) {
				ctx.addIssue({
					code: 'custom',
					message: 'Field names must be different, whatever their capital letters.',
					path: [index, 'name']
				});
			}
			names.add(key);
		}
	});

const IDENTIFIER_MESSAGE =
	"The identifier must be one of the schema's text fields, or left as the default.";

const identifierFieldId = z.uuid().nullable();

type Fields = z.infer<typeof contactSchemaFieldsSchema>;

/** Whether `id` is a text field in `fields`; true when there is no identifier. */
function identifierFits(fields: Fields, id: string | null | undefined): boolean {
	if (!id) return true;
	return fields.some((field) => field.id === id && field.type === 'text');
}

/** Body of `POST /api/v1/organizations/{organization_id}/contact-schemas`. */
export const createContactSchemaSchema = z
	.object({
		schema_name: schemaName,
		fields: contactSchemaFieldsSchema,
		/** The id of a text field in `fields` that labels a contact. Null or left out uses the full address. It is always required, whatever its `required` says. */
		identifier_field_id: identifierFieldId.optional()
	})
	.refine((body) => identifierFits(body.fields, body.identifier_field_id), {
		message: IDENTIFIER_MESSAGE,
		path: ['identifier_field_id']
	});

/** Body of `PATCH /api/v1/contact-schemas/{contact_schema_id}`. Omitted fields keep their value. */
export const updateContactSchemaSchema = z
	.object({
		schema_name: schemaName.optional(),
		/** The schema's full list of fields. One whose id is not listed is removed. */
		fields: contactSchemaFieldsSchema.optional(),
		/** Null goes back to the full address. Left out keeps the current identifier. */
		identifier_field_id: identifierFieldId.optional()
	})
	.refine(
		(body) =>
			body.schema_name !== undefined ||
			body.fields !== undefined ||
			body.identifier_field_id !== undefined,
		{ message: 'Send something to change.' }
	)
	// With the fields in the same request the identifier can be checked here;
	// without them the database checks it against the stored fields.
	.refine(
		(body) => body.fields === undefined || identifierFits(body.fields, body.identifier_field_id),
		{
			message: IDENTIFIER_MESSAGE,
			path: ['identifier_field_id']
		}
	);

/** Body of `PUT /api/v1/organizations/{organization_id}/contact-schema-order`: every schema id, in the new order. */
export const contactSchemaOrderSchema = z.object({
	ids: z.array(z.uuid()).max(1000)
});

export type CreateContactSchemaInput = z.infer<typeof createContactSchemaSchema>;
export type UpdateContactSchemaInput = z.infer<typeof updateContactSchemaSchema>;
export type ContactSchemaFieldInput = z.infer<typeof contactSchemaFieldSchema>;
