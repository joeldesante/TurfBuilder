import { describe, expect, it } from 'vitest';
import {
	buildingText,
	dedupeKeys,
	groupBySharedKey,
	recoverCase,
	splitThoroughfare,
	splitUnit,
	toAddressFields,
	type ParsedComponent
} from './address-parse';

describe('recoverCase', () => {
	it('returns the original casing of a lowercased value', () => {
		expect(recoverCase('2445 Harlan St, Philadelphia', 'harlan st')).toBe('Harlan St');
	});

	it('returns the value as given when the original does not contain it', () => {
		expect(recoverCase('2445 Harlan St', 'harlan street')).toBe('harlan street');
	});
});

describe('splitThoroughfare', () => {
	it('splits the type off the name', () => {
		expect(splitThoroughfare('Harlan St')).toEqual({ pre: null, name: 'Harlan', type: 'St', post: null });
	});

	it('splits leading and trailing directionals into the qualifiers', () => {
		expect(splitThoroughfare('N Broad Street SW')).toEqual({
			pre: 'N',
			name: 'Broad',
			type: 'Street',
			post: 'SW'
		});
	});

	it('keeps a single word as the name, even when it looks like a type', () => {
		expect(splitThoroughfare('Broadway')).toEqual({ pre: null, name: 'Broadway', type: null, post: null });
		expect(splitThoroughfare('Circle')).toEqual({ pre: null, name: 'Circle', type: null, post: null });
	});

	it('does not take a directional that is the whole name', () => {
		expect(splitThoroughfare('North Ave')).toEqual({ pre: null, name: 'North', type: 'Ave', post: null });
	});
});

describe('splitUnit', () => {
	it('splits a known unit type from the identifier', () => {
		expect(splitUnit('Apt 4B')).toEqual({ unit_type: 'Apt', unit_identifier: '4B' });
		expect(splitUnit('Suite 210')).toEqual({ unit_type: 'Suite', unit_identifier: '210' });
		expect(splitUnit('# 12')).toEqual({ unit_type: '#', unit_identifier: '12' });
	});

	it('keeps a bare identifier without a type', () => {
		expect(splitUnit('4B')).toEqual({ unit_type: null, unit_identifier: '4B' });
	});
});

describe('toAddressFields', () => {
	const text = '2445 N Harlan St, Apt 4B, Philadelphia, PA 19121';
	const components: ParsedComponent[] = [
		{ label: 'house_number', value: '2445' },
		{ label: 'road', value: 'n harlan st' },
		{ label: 'unit', value: 'apt 4b' },
		{ label: 'city', value: 'philadelphia' },
		{ label: 'state', value: 'pa' },
		{ label: 'postcode', value: '19121' }
	];

	it('maps libpostal labels onto S42 fields with the original casing', () => {
		const parsed = toAddressFields(components, text, '2445 N Harlan St');

		expect(parsed).toMatchObject({
			premises_number: '2445',
			premises_name: null,
			thoroughfare_pre_qualifier: 'N',
			thoroughfare_name: 'Harlan',
			thoroughfare_type: 'St',
			locality: 'Philadelphia',
			region: 'PA',
			postcode: '19121',
			unit: { unit_type: 'Apt', unit_identifier: '4B' },
			needsReview: false
		});
	});

	it('keeps line 1 whole as the building name when libpostal finds no building', () => {
		const parsed = toAddressFields(
			[{ label: 'road', value: 'rural route 2' }],
			'Rural Route 2, Somewhere',
			'Rural Route 2'
		);

		expect(parsed.needsReview).toBe(true);
		expect(parsed.premises_name).toBe('Rural Route 2');
		expect(parsed.premises_number).toBeNull();
	});
});

describe('buildingText', () => {
	it('leaves the unit out, so units in one building share an address', () => {
		const parsed = toAddressFields(
			[
				{ label: 'house_number', value: '10' },
				{ label: 'road', value: 'main st' },
				{ label: 'unit', value: 'apt 2' }
			],
			'10 Main St, Apt 2',
			'10 Main St'
		);
		expect(buildingText(parsed)).toBe('10 Main St');
	});
});

describe('dedupeKeys', () => {
	it('scopes every expansion by country and postcode', () => {
		const parsed = toAddressFields(
			[
				{ label: 'house_number', value: '10' },
				{ label: 'road', value: 'main st' },
				{ label: 'postcode', value: '19121' }
			],
			'10 Main St 19121',
			'10 Main St'
		);
		expect(dedupeKeys(['10 main street', '10 main saint'], parsed, 'US')).toEqual([
			'US|19121|10 main street',
			'US|19121|10 main saint'
		]);
	});
});

describe('groupBySharedKey', () => {
	it('groups items that share any key, transitively', () => {
		const items = [
			{ id: 'a', keys: ['1', '2'] },
			{ id: 'b', keys: ['3'] },
			{ id: 'c', keys: ['2', '4'] },
			{ id: 'd', keys: ['4'] }
		];

		const groups = groupBySharedKey(items, (i) => i.keys).map((g) => g.map((i) => i.id));

		expect(groups).toEqual([['a', 'c', 'd'], ['b']]);
	});
});
