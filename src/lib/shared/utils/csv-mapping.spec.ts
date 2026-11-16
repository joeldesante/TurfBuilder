import { describe, it, expect } from 'vitest';
import { mapTargets, mappingFormSchema, suggestMapping } from './csv-mapping';
import type { ContactSchemaField } from '$lib/shared/types/contact-schemas';

const field = (id: string, name: string, required = false): ContactSchemaField => ({
	id,
	name,
	type: 'text',
	required
});

const fields = [field('f1', 'name', true), field('f2', 'phone'), field('f3', 'open')];

const LAT = 'contact.latitude';
const LNG = 'contact.longitude';

describe('mapTargets', () => {
	it('lists the contact data first, then the schema fields', () => {
		const targets = mapTargets(fields);

		expect(targets.filter((t) => t.contactData).map((t) => t.id)).toEqual([
			'contact.latitude',
			'contact.longitude',
			'contact.address_line_1',
			'contact.address_line_2',
			'contact.city',
			'contact.state_or_region',
			'contact.postal_code',
			'contact.country_code'
		]);
		expect(targets.slice(-3).map((t) => t.id)).toEqual(['f1', 'f2', 'f3']);
		expect(targets.slice(-3).every((t) => !t.contactData)).toBe(true);
	});

	it("carries each target's name, type and whether it is required", () => {
		const byId = Object.fromEntries(mapTargets(fields).map((t) => [t.id, t]));

		expect(byId[LAT]).toMatchObject({ name: 'Latitude', type: 'number', required: true });
		expect(byId['contact.city']).toMatchObject({ name: 'City', type: 'text', required: false });
		expect(byId.f1).toMatchObject({ name: 'name', required: true, contactData: false });
	});

	it('is just the contact data for a schema with no fields', () => {
		expect(mapTargets([]).every((t) => t.contactData)).toBe(true);
	});
});

describe('suggestMapping', () => {
	it('gives each schema field the column with its name', () => {
		expect(suggestMapping(['name', 'phone'], fields)).toEqual({ f1: 0, f2: 1 });
	});

	it('ignores case, spaces, and punctuation', () => {
		expect(suggestMapping(['NAME', 'Phone #', ' Open? '], fields)).toEqual({ f1: 0, f2: 1, f3: 2 });
	});

	it('leaves out a field no column suits', () => {
		expect(suggestMapping(['notes', 'name'], fields)).toEqual({ f1: 1 });
	});

	it('gives a field the first column that suits it', () => {
		expect(suggestMapping(['name', 'Name'], fields)).toEqual({ f1: 0 });
	});

	it('skips a blank header', () => {
		expect(suggestMapping(['', 'phone'], fields)).toEqual({ f2: 1 });
	});

	it('suggests nothing for a file with no columns', () => {
		expect(suggestMapping([], fields)).toEqual({});
	});

	describe('contact data', () => {
		it('matches the coordinates by name', () => {
			expect(suggestMapping(['Latitude', 'Longitude'], [])).toEqual({ [LAT]: 0, [LNG]: 1 });
		});

		it.each([
			['lat', LAT],
			['LAT', LAT],
			['Lng', LNG],
			['lon', LNG],
			['Long', LNG],
			['Street', 'contact.address_line_1'],
			['Address', 'contact.address_line_1'],
			['Address 1', 'contact.address_line_1'],
			['Address Line 1', 'contact.address_line_1'],
			['address_line_1', 'contact.address_line_1'],
			['Address 2', 'contact.address_line_2'],
			['Suite', 'contact.address_line_2'],
			['City', 'contact.city'],
			['Town', 'contact.city'],
			['State', 'contact.state_or_region'],
			['Province', 'contact.state_or_region'],
			['state_or_region', 'contact.state_or_region'],
			['ZIP', 'contact.postal_code'],
			['Zip Code', 'contact.postal_code'],
			['Postal Code', 'contact.postal_code'],
			['Postcode', 'contact.postal_code'],
			['Country', 'contact.country_code'],
			['country_code', 'contact.country_code']
		])('matches the column "%s" to %s', (header, id) => {
			expect(suggestMapping([header], [])).toEqual({ [id]: 0 });
		});

		it('does not match a header that only contains a contact data word', () => {
			expect(suggestMapping(['Latitude (deg)', 'City Council', 'Zipper'], [])).toEqual({});
		});

		it('suggests contact data and schema fields together', () => {
			expect(suggestMapping(['Name', 'Lat', 'Lng', 'Phone', 'Street', 'Notes'], fields)).toEqual({
				f1: 0,
				[LAT]: 1,
				[LNG]: 2,
				f2: 3,
				'contact.address_line_1': 4
			});
		});

		it('gives a contact data field the first column that suits it, of several that would', () => {
			expect(suggestMapping(['lat', 'Latitude', 'y'], [])).toEqual({ [LAT]: 0 });
			expect(suggestMapping(['Zip', 'Postal Code', 'ZipCode'], [])).toEqual({
				'contact.postal_code': 0
			});
		});
	});

	describe('one column for several fields', () => {
		it('suggests a column for every field it suits, so a schema field and contact data can share it', () => {
			const withCity = [...fields, field('f4', 'City')];

			expect(suggestMapping(['City'], withCity)).toEqual({ f4: 0, 'contact.city': 0 });
		});

		it('lets one column be the street and a schema field called Address', () => {
			const withAddress = [...fields, field('f5', 'Address')];

			expect(suggestMapping(['Address'], withAddress)).toEqual({
				f5: 0,
				'contact.address_line_1': 0
			});
		});

		it('lets the coordinates share a column', () => {
			// A field can only be suggested one column, but two fields may name the same one.
			expect(suggestMapping(['Lat', 'Lng', 'Latitude'], [])).toEqual({ [LAT]: 0, [LNG]: 1 });
			expect(suggestMapping(['y'], [])).toEqual({ [LAT]: 0 });
		});
	});
});

describe('mappingFormSchema', () => {
	const schema = mappingFormSchema(fields, 5);
	const issues = (mapping: Record<string, number>) => {
		const result = schema.safeParse({ mapping });
		return result.success ? [] : result.error.issues;
	};

	it('accepts a mapping with the coordinates and every required schema field', () => {
		expect(schema.safeParse({ mapping: { [LAT]: 3, [LNG]: 4, f1: 0 } }).success).toBe(true);
	});

	it('does not need the address or the schema fields that are not required', () => {
		expect(issues({ [LAT]: 3, [LNG]: 4, f1: 0 })).toEqual([]);
	});

	it('names each required field that has no column, at mapping.<id>', () => {
		expect(issues({}).map((issue) => [issue.path.join('.'), issue.message])).toEqual([
			['mapping.contact.latitude', 'Latitude needs a column'],
			['mapping.contact.longitude', 'Longitude needs a column'],
			['mapping.f1', 'name needs a column']
		]);
	});

	it('names only the one that is missing', () => {
		expect(issues({ [LAT]: 3, f1: 0 }).map((issue) => issue.message)).toEqual([
			'Longitude needs a column'
		]);
	});

	it('still wants the coordinates when the schema has no fields', () => {
		const bare = mappingFormSchema([], 5);
		const result = bare.safeParse({ mapping: {} });

		expect(result.success).toBe(false);
		expect(result.success ? [] : result.error.issues.map((i) => i.message)).toEqual([
			'Latitude needs a column',
			'Longitude needs a column'
		]);
	});

	it('lets one column fill several fields', () => {
		expect(schema.safeParse({ mapping: { [LAT]: 0, [LNG]: 0, f1: 0, f2: 0 } }).success).toBe(true);
	});

	it('refuses a column the file does not have', () => {
		const found = issues({ [LAT]: 3, [LNG]: 4, f1: 0, f2: 5 });

		expect(found.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
			['mapping.f2', 'That column is not in the file']
		]);
	});

	it.each([[-1], [1.5]])('refuses the column %s', (column) => {
		expect(schema.safeParse({ mapping: { [LAT]: column, [LNG]: 4, f1: 0 } }).success).toBe(false);
	});

	it('wants a mapping, not nothing', () => {
		expect(schema.safeParse({}).success).toBe(false);
		expect(schema.safeParse({ mapping: null }).success).toBe(false);
	});
});
