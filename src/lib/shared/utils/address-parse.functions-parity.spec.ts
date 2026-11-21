import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { streetFields, unitFields } from './location-address';

// The contact import function is deployed on its own, so it keeps a copy of the address parsing
// (functions/packages/imports/import-contacts/address.js). This runs both over the same text and
// fails if the copy drifts from the app's, which would store the same address two ways.
const require = createRequire(import.meta.url);
const copy = require('../../../../functions/packages/imports/import-contacts/address.js') as {
	streetFields: (line: string | null | undefined, name?: string | null) => unknown;
	unitFields: (line: string | null | undefined) => unknown;
};

const FIRST_LINES = [
	'6230 Ninth Pl',
	'526 Market St',
	'12B Elm Rd',
	'100 N Main Street',
	'42 Broadway',
	'7 North Ave',
	'9 West Lake Shore Dr SW',
	'1600 Pennsylvania Ave NW',
	'Harbour House',
	'  3  Oak   Ln  ',
	'',
	null,
	undefined
];

const SECOND_LINES = [
	'Apt 4B',
	'Unit 12',
	'#7',
	'Suite 300',
	'4B',
	'Ste. 5',
	'',
	'   ',
	null,
	undefined
];

describe('the import function copy of the address parsing', () => {
	it.each(FIRST_LINES)('splits the first line %j as the app does', (line) => {
		expect(copy.streetFields(line, null)).toEqual(streetFields(line, null));
	});

	it('names an address with no line after the contact, as the app does', () => {
		expect(copy.streetFields('', 'Corner Cafe')).toEqual(streetFields('', 'Corner Cafe'));
	});

	it.each(SECOND_LINES)('splits the second line %j as the app does', (line) => {
		expect(copy.unitFields(line)).toEqual(unitFields(line));
	});
});
