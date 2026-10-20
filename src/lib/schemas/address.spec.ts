import { describe, expect, it } from 'vitest';
import { AddressFieldsSchema } from './address';

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

/** The valid address without one field. */
function without(field: keyof typeof valid) {
	return Object.fromEntries(Object.entries(valid).filter(([key]) => key !== field));
}

describe('AddressFieldsSchema', () => {
	it('accepts an address with a building number', () => {
		expect(AddressFieldsSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a building name instead of a number', () => {
		expect(
			AddressFieldsSchema.safeParse({ ...without('premises_number'), premises_name: 'Empire State Building' })
				.success
		).toBe(true);
	});

	it('rejects an address with neither a building number nor a name', () => {
		expect(AddressFieldsSchema.safeParse(without('premises_number')).success).toBe(false);
	});

	it('requires coordinates and an uppercase two-letter country code', () => {
		expect(AddressFieldsSchema.safeParse(without('latitude')).success).toBe(false);
		expect(AddressFieldsSchema.safeParse({ ...valid, country_code: 'us' }).success).toBe(false);
		expect(AddressFieldsSchema.safeParse({ ...valid, country_code: 'USA' }).success).toBe(false);
	});

	it('accepts a unit, and rejects a unit type without the unit it names', () => {
		expect(
			AddressFieldsSchema.safeParse({ ...valid, unit_type: 'Apt', unit_identifier: '4B', floor: '4' }).success
		).toBe(true);
		expect(AddressFieldsSchema.safeParse({ ...valid, unit_identifier: '4B' }).success).toBe(true);
		expect(AddressFieldsSchema.safeParse({ ...valid, unit_type: 'Apt' }).success).toBe(false);
	});
});
