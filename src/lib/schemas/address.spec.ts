import { describe, expect, it } from 'vitest';
import { AddressFieldsSchema, UnitFieldsSchema } from './address';

const valid = {
	premises_number: '2445',
	thoroughfare_name: 'Harlan',
	thoroughfare_type: 'St',
	locality: 'Philadelphia',
	region: 'PA',
	postcode: '19121',
	country_code: 'US',
	latitude: 39.98,
	longitude: -75.18
};

describe('AddressFieldsSchema', () => {
	it('accepts an address with a building number', () => {
		expect(AddressFieldsSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a building name instead of a number', () => {
		const { premises_number: _, ...rest } = valid;
		expect(AddressFieldsSchema.safeParse({ ...rest, premises_name: 'Empire State Building' }).success).toBe(true);
	});

	it('rejects an address with neither a building number nor a name', () => {
		const { premises_number: _, ...rest } = valid;
		expect(AddressFieldsSchema.safeParse(rest).success).toBe(false);
	});

	it('requires coordinates and an uppercase two-letter country code', () => {
		const { latitude: _, ...noLatitude } = valid;
		expect(AddressFieldsSchema.safeParse(noLatitude).success).toBe(false);
		expect(AddressFieldsSchema.safeParse({ ...valid, country_code: 'us' }).success).toBe(false);
		expect(AddressFieldsSchema.safeParse({ ...valid, country_code: 'USA' }).success).toBe(false);
	});
});

describe('UnitFieldsSchema', () => {
	it('requires an identifier and allows the type and floor to be missing', () => {
		expect(UnitFieldsSchema.safeParse({ unit_identifier: '4B' }).success).toBe(true);
		expect(UnitFieldsSchema.safeParse({ unit_type: 'Apt' }).success).toBe(false);
		expect(UnitFieldsSchema.safeParse({ unit_identifier: '   ' }).success).toBe(false);
	});
});
