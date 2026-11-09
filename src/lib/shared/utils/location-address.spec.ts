import { describe, expect, it } from 'vitest';
import {
	addressLine1,
	addressLine2,
	editedAddress,
	locationToAddress,
	streetFields,
	UNNAMED_PLACE,
	unitFields
} from './location-address';

const LIBERTY = {
	name: 'Liberty Bell',
	address_line_1: '526 Market St',
	address_line_2: null,
	city: 'Philadelphia',
	state_or_region: 'PA',
	postal_code: '19106',
	country_code: 'US',
	latitude: 39.9496,
	longitude: -75.1503
};

describe('streetFields', () => {
	it('splits a numbered line into number and thoroughfare', () => {
		expect(streetFields('1400 N John F Kennedy Blvd')).toEqual({
			premises_name: null,
			premises_number: '1400',
			thoroughfare_name: 'John F Kennedy',
			thoroughfare_type: 'Blvd',
			thoroughfare_pre_qualifier: 'N',
			thoroughfare_post_qualifier: null
		});
	});

	it('keeps a line with no number as the building name', () => {
		expect(streetFields('Harbour House')).toMatchObject({
			premises_name: 'Harbour House',
			premises_number: null,
			thoroughfare_name: null
		});
	});

	it('names the building after the contact, or a placeholder, when there is no line', () => {
		expect(streetFields(null, 'Deli').premises_name).toBe('Deli');
		expect(streetFields('  ', '').premises_name).toBe(UNNAMED_PLACE);
	});
});

describe('unitFields', () => {
	it('splits a unit type from its identifier', () => {
		expect(unitFields('Apt 4B')).toEqual({ unit_type: 'Apt', unit_identifier: '4B' });
		expect(unitFields('')).toEqual({ unit_type: null, unit_identifier: null });
	});
});

describe('reading back', () => {
	it('joins the street, or falls back to the building name', () => {
		expect(addressLine1(streetFields('526 Market St'))).toBe('526 Market St');
		expect(addressLine1(streetFields('Harbour House'))).toBe('Harbour House');
		expect(addressLine2(unitFields('Suite 200'))).toBe('Suite 200');
		expect(addressLine2({})).toBeNull();
	});
});

describe('locationToAddress', () => {
	it('maps the flat fields onto the address columns', () => {
		expect(locationToAddress(LIBERTY, 'CA')).toMatchObject({
			premises_number: '526',
			thoroughfare_name: 'Market',
			thoroughfare_type: 'St',
			locality: 'Philadelphia',
			region: 'PA',
			postcode: '19106',
			country_code: 'US',
			latitude: 39.9496,
			longitude: -75.1503
		});
	});

	it('uses the default country when none is given', () => {
		expect(locationToAddress({ ...LIBERTY, country_code: null }, 'US').country_code).toBe('US');
		expect(locationToAddress({ ...LIBERTY, country_code: 'ca' }, 'US').country_code).toBe('CA');
	});
});

describe('editedAddress', () => {
	const current = { ...locationToAddress(LIBERTY, 'US'), premises_name: 'Bell Pavilion' };

	it('is null when the edit leaves the address alone', () => {
		expect(editedAddress(current, { ...LIBERTY })).toBeNull();
		expect(editedAddress(current, { ...LIBERTY, country_code: null })).toBeNull();
	});

	it('keeps the parts the flat shape does not show when the line is unchanged', () => {
		const moved = editedAddress(current, { ...LIBERTY, latitude: 39.95 });
		expect(moved).toMatchObject({ premises_name: 'Bell Pavilion', latitude: 39.95 });
	});

	it('parses the first line again when it changed', () => {
		const edited = editedAddress(current, { ...LIBERTY, address_line_1: '520 Chestnut St' });
		expect(edited).toMatchObject({
			premises_name: null,
			premises_number: '520',
			thoroughfare_name: 'Chestnut'
		});
	});

	it('clears a field the edit blanked', () => {
		expect(editedAddress(current, { ...LIBERTY, postal_code: '' })?.postcode).toBeNull();
	});
});
