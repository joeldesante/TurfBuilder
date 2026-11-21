/** The data types a contact schema field can expect. Add new ones here and in the `type` check of `universe.contact_schema_field`. */
export const CONTACT_SCHEMA_FIELD_TYPES = ['text', 'boolean', 'number'] as const;

export type ContactSchemaFieldType = (typeof CONTACT_SCHEMA_FIELD_TYPES)[number];

/** How each field type is named to people. */
export const CONTACT_SCHEMA_FIELD_TYPE_LABELS: Record<ContactSchemaFieldType, string> = {
	text: 'Text',
	boolean: 'True/False',
	number: 'Number'
};

/**
 * One field of a contact schema. A contact keeps the field's value in its
 * metadata under `id`, not under the name, so renaming a field changes this row
 * and nothing else. Filters, the identifier, and the required flag all point at
 * the id.
 */
export interface ContactSchemaField {
	id: string;
	name: string;
	type: ContactSchemaFieldType;
	/** Every contact of the schema must have a value. The identifier field is always required. */
	required: boolean;
}

/** A contact schema, with how many contact versions name it. */
export interface ContactSchema {
	id: string;
	org_id: string;
	schema_name: string;
	/** The fields in the order staff arranged them. */
	fields: ContactSchemaField[];
	/**
	 * The id of the text field whose value labels a contact. Null labels a
	 * contact by its full address, and by its coordinates when it has no address
	 * text.
	 */
	identifier_field_id: string | null;
	/** Contact versions (current and past) that name this schema. The schema can only be deleted at 0. */
	contact_count: number;
	created_at: string;
	updated_at: string;
}

/** A current contact as a schema's contact list shows it. */
export interface SchemaContact {
	/** The contact's entity id, which stays the same across versions. */
	id: string;
	/** What labels the contact: its schema's identifier field, else its full address, else its coordinates. Null only for a contact with none of these. */
	identifier: string | null;
	/** Values by field id. A field the contact has no value for is absent. */
	metadata: Record<string, unknown>;
}

/** A current contact in the "All" list, with the schema it uses if any. */
export interface AllContact extends SchemaContact {
	schema_id: string | null;
	schema_name: string | null;
}
