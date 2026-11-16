import type { ContactSchemaFieldType } from '$lib/shared/types/contact-schemas';

/**
 * What every contact carries whatever its schema: where it is. A contact is a
 * contact at an address, so the address parts and the coordinates are part of
 * it, beside the fields of its schema. They are the flat fields the location
 * forms use (`$lib/schemas/location`), and a CSV import maps its columns onto
 * them as well as onto the schema's fields.
 *
 * Only the coordinates are required, as in `LocationFieldsSchema`: a contact
 * has to be somewhere on the map, but its street address can be missing.
 * Address line 3 is left out because it is not stored.
 */
export interface ContactDataField {
	/** `contact.` and the field's key, which tells it from a schema field's id (a uuid). */
	id: string;
	/** The key the location forms and the API use. */
	key: string;
	/** What people call it. */
	name: string;
	type: ContactSchemaFieldType;
	required: boolean;
	/**
	 * Other names a CSV column might have for it, to suggest it by. Compared with case,
	 * spaces and punctuation ignored, so "Zip Code" matches `zipcode`.
	 */
	aliases: string[];
}

/** What every contact data field's id starts with. */
export const CONTACT_DATA_PREFIX = 'contact.';

const field = (
	key: string,
	name: string,
	type: ContactSchemaFieldType,
	required: boolean,
	aliases: string[]
): ContactDataField => ({ id: `${CONTACT_DATA_PREFIX}${key}`, key, name, type, required, aliases });

/** The contact data fields, required ones first, then the address from the street to the country. */
export const CONTACT_DATA_FIELDS: readonly ContactDataField[] = [
	field('latitude', 'Latitude', 'number', true, ['lat', 'y', 'ycoord', 'ycoordinate']),
	field('longitude', 'Longitude', 'number', true, [
		'lng',
		'lon',
		'long',
		'x',
		'xcoord',
		'xcoordinate'
	]),
	field('address_line_1', 'Address line 1', 'text', false, [
		'address',
		'address1',
		'street',
		'streetaddress',
		'streetaddress1',
		'addr',
		'addr1'
	]),
	field('address_line_2', 'Address line 2', 'text', false, [
		'address2',
		'streetaddress2',
		'addr2',
		'unit',
		'apt',
		'apartment',
		'suite'
	]),
	field('city', 'City', 'text', false, ['town', 'locality']),
	field('state_or_region', 'State or region', 'text', false, [
		'state',
		'region',
		'province',
		'stateprovince'
	]),
	field('postal_code', 'Postal code', 'text', false, [
		'postal',
		'zip',
		'zipcode',
		'postcode',
		'zip5'
	]),
	field('country_code', 'Country code', 'text', false, ['country', 'countryiso', 'iso2'])
];

/** Whether an id is a contact data field's, and not a schema field's. */
export function isContactDataId(id: string): boolean {
	return CONTACT_DATA_FIELDS.some((f) => f.id === id);
}

/** A contact data field by its id, or undefined for any other id. */
export function contactDataField(id: string): ContactDataField | undefined {
	return CONTACT_DATA_FIELDS.find((f) => f.id === id);
}
