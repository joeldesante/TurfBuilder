import { z } from 'zod';
import type { ContactSchemaField, ContactSchemaFieldType } from '$lib/shared/types/contact-schemas';
import { CONTACT_DATA_FIELDS } from './contact-data-fields';

/**
 * Which CSV column fills each field: the field's id (a schema field's id, or a contact data
 * field's id such as `contact.latitude`) to the column's position, counting from 0. A field
 * that is missing has no column. Any column can fill any number of fields, so one `Address`
 * column can be the street and the building at once.
 */
export type ColumnMapping = Record<string, number>;

/** Somewhere a CSV column can be mapped: a contact data field, or a field of the schema. */
export interface MapTarget {
	/** `contact.` and a key for contact data, or the schema field's id. */
	id: string;
	name: string;
	type: ContactSchemaFieldType;
	required: boolean;
	/** Contact data (where the contact is) and not one of the schema's own fields. */
	contactData: boolean;
}

/**
 * Everywhere a column can go for a schema: the contact data every contact has (its
 * address and coordinates), then the schema's own fields.
 */
export function mapTargets(fields: ContactSchemaField[]): MapTarget[] {
	return [
		...CONTACT_DATA_FIELDS.map((f) => ({
			id: f.id,
			name: f.name,
			type: f.type,
			required: f.required,
			contactData: true
		})),
		...fields.map((f) => ({
			id: f.id,
			name: f.name,
			type: f.type,
			required: f.required,
			contactData: false
		}))
	];
}

/** A header or field name with case, spaces, and punctuation removed, so "Phone #" matches "phone". */
function normalize(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Suggests a column for each field by name. A field of the schema takes the first column
 * with its own name; a contact data field takes the first column with its name or a common
 * alias (`lat`, `zip`, `street`). Each field is looked at on its own, so a column that suits
 * two fields is suggested for both. A field no column suits is left out.
 */
export function suggestMapping(headers: string[], fields: ContactSchemaField[]): ColumnMapping {
	const columns = headers.map(normalize);
	const mapping: ColumnMapping = {};

	const firstColumn = (accepts: (header: string) => boolean) =>
		columns.findIndex((header) => header !== '' && accepts(header));

	for (const field of fields) {
		const wanted = normalize(field.name);
		const column = firstColumn((header) => header === wanted);
		if (column !== -1) mapping[field.id] = column;
	}
	for (const field of CONTACT_DATA_FIELDS) {
		const names = [normalize(field.name), normalize(field.key), ...field.aliases];
		const column = firstColumn((header) => names.includes(header));
		if (column !== -1) mapping[field.id] = column;
	}
	return mapping;
}

/**
 * The rules a mapping has to meet, for a `Form`: every required field has a column (the
 * coordinates and the schema's required fields), and every column is one the file has. The
 * error for a field is under `mapping.<field id>`, so the mapper can show it on its row.
 * The columns are the file's, so a new schema or file needs a new schema of rules.
 */
export function mappingFormSchema(fields: ContactSchemaField[], columnCount: number) {
	return z
		.object({ mapping: z.record(z.string(), z.number().int().min(0)) })
		.superRefine(({ mapping }, ctx) => {
			for (const target of mapTargets(fields)) {
				if (target.required && mapping[target.id] === undefined) {
					ctx.addIssue({
						code: 'custom',
						path: ['mapping', target.id],
						message: `${target.name} needs a column`
					});
				}
			}
			for (const [id, column] of Object.entries(mapping)) {
				if (column >= columnCount) {
					ctx.addIssue({
						code: 'custom',
						path: ['mapping', id],
						message: 'That column is not in the file'
					});
				}
			}
		});
}
