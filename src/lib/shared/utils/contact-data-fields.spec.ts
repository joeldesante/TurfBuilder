import { describe, it, expect } from 'vitest';
import { LocationFieldsSchema } from '$lib/schemas/location';
import {
	CONTACT_DATA_FIELDS,
	CONTACT_DATA_PREFIX,
	contactDataField,
	isContactDataId
} from './contact-data-fields';

describe('CONTACT_DATA_FIELDS', () => {
	it('has the coordinates as the required fields, and nothing else required', () => {
		const required = CONTACT_DATA_FIELDS.filter((f) => f.required).map((f) => f.key);

		expect(required).toEqual(['latitude', 'longitude']);
	});

	it('lists the address from the street to the country', () => {
		expect(CONTACT_DATA_FIELDS.filter((f) => !f.required).map((f) => f.key)).toEqual([
			'address_line_1',
			'address_line_2',
			'city',
			'state_or_region',
			'postal_code',
			'country_code'
		]);
	});

	it('only names fields a location really has, so a mapping can be saved', () => {
		const shape = Object.keys(LocationFieldsSchema.shape);

		for (const field of CONTACT_DATA_FIELDS) expect(shape).toContain(field.key);
	});

	it('agrees with the location schema on which of them are required', () => {
		const optional = LocationFieldsSchema.safeParse({ latitude: 1, longitude: 2 });

		// With only the coordinates the location is valid, and with no coordinates it is not.
		expect(optional.success).toBe(true);
		expect(LocationFieldsSchema.safeParse({}).success).toBe(false);
	});

	it('gives each field an id that starts with the prefix and names its key', () => {
		for (const field of CONTACT_DATA_FIELDS) {
			expect(field.id).toBe(`${CONTACT_DATA_PREFIX}${field.key}`);
		}
	});

	it('has unique ids', () => {
		const ids = CONTACT_DATA_FIELDS.map((f) => f.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	it('makes the coordinates numbers and the address text', () => {
		expect(contactDataField('contact.latitude')?.type).toBe('number');
		expect(contactDataField('contact.longitude')?.type).toBe('number');
		expect(contactDataField('contact.city')?.type).toBe('text');
	});

	it('gives an alias to no more than one field', () => {
		const seen = new Map<string, string>();
		for (const field of CONTACT_DATA_FIELDS) {
			for (const alias of field.aliases) {
				expect(seen.get(alias), `${alias} is on two fields`).toBeUndefined();
				seen.set(alias, field.key);
			}
		}
	});

	it('keeps aliases already normalized: lower case with no spaces or punctuation', () => {
		for (const field of CONTACT_DATA_FIELDS) {
			for (const alias of field.aliases) expect(alias).toMatch(/^[a-z0-9]+$/);
		}
	});
});

describe('isContactDataId and contactDataField', () => {
	it('know a contact data field by its id', () => {
		expect(isContactDataId('contact.postal_code')).toBe(true);
		expect(contactDataField('contact.postal_code')?.name).toBe('Postal code');
	});

	it('do not take a schema field id, an empty id, or an unknown key for one', () => {
		for (const id of ['11111111-1111-4111-8111-111111111111', '', 'contact.nope', 'latitude']) {
			expect(isContactDataId(id)).toBe(false);
			expect(contactDataField(id)).toBeUndefined();
		}
	});
});
