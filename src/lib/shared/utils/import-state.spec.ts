import { describe, it, expect } from 'vitest';
import { importStateParams, mappingFits, parseImportState } from './import-state';

const FILE = '3f1c2b9e-0000-4000-8000-000000000001';
const SCHEMA = '11111111-1111-4111-8111-111111111111';
const F1 = '22222222-2222-4222-8222-222222222222';
const F2 = '33333333-3333-4333-8333-333333333333';

const params = (query: string) => new URLSearchParams(query);

describe('parseImportState', () => {
	it('has no state without a file', () => {
		expect(parseImportState(params(''))).toBeNull();
		expect(parseImportState(params('tab=spreadsheet&schema=' + SCHEMA))).toBeNull();
	});

	it('has no state for a file id that is not an id', () => {
		expect(parseImportState(params('file=nope'))).toBeNull();
		expect(parseImportState(params(`file=${FILE}x`))).toBeNull();
	});

	it('starts on the mapping tab with no schema and no mapping', () => {
		expect(parseImportState(params(`file=${FILE}`))).toEqual({
			fileId: FILE,
			tab: 'mapping',
			schemaId: '',
			mapping: null
		});
	});

	it('reads the tab, the schema, and the mapping', () => {
		expect(
			parseImportState(params(`file=${FILE}&tab=spreadsheet&schema=${SCHEMA}&m=${F1}:0,${F2}:2`))
		).toEqual({
			fileId: FILE,
			tab: 'spreadsheet',
			schemaId: SCHEMA,
			mapping: { [F1]: 0, [F2]: 2 }
		});
	});

	it('falls back to the mapping tab for any other tab', () => {
		expect(parseImportState(params(`file=${FILE}&tab=whatever`))?.tab).toBe('mapping');
	});

	it('ignores a schema that is not an id', () => {
		expect(parseImportState(params(`file=${FILE}&schema=abc`))?.schemaId).toBe('');
	});

	it('keeps a mapping that is there but empty, as no columns', () => {
		expect(parseImportState(params(`file=${FILE}&m=`))?.mapping).toEqual({});
	});

	describe('the mapping', () => {
		const mapping = (m: string) => parseImportState(params(`file=${FILE}&m=${m}`))?.mapping;

		it('reads contact data fields, which are not uuids', () => {
			expect(mapping('contact.latitude:3,contact.longitude:4,contact.city:1')).toEqual({
				'contact.latitude': 3,
				'contact.longitude': 4,
				'contact.city': 1
			});
		});

		it('lets one column fill several fields', () => {
			expect(mapping(`${F1}:0,contact.address_line_1:0`)).toEqual({
				[F1]: 0,
				'contact.address_line_1': 0
			});
		});

		it('drops a pair whose field is not a field', () => {
			expect(mapping(`contact.nope:1,junk:2,${F1}:0`)).toEqual({ [F1]: 0 });
		});

		it('drops a pair whose column is not a whole number', () => {
			expect(mapping(`${F1}:x,${F2}:-1,contact.city:1.5,contact.latitude:2`)).toEqual({
				'contact.latitude': 2
			});
		});

		it('drops a pair with no column, or with extra parts', () => {
			expect(mapping(`${F1},${F2}:1:2,contact.city:1`)).toEqual({ 'contact.city': 1 });
		});

		it('takes the last column for a field named twice', () => {
			expect(mapping(`${F1}:0,${F1}:2`)).toEqual({ [F1]: 2 });
		});
	});
});

describe('importStateParams', () => {
	const state = {
		fileId: FILE,
		tab: 'spreadsheet' as const,
		schemaId: SCHEMA,
		mapping: { [F1]: 0, 'contact.latitude': 3, 'contact.longitude': 4 }
	};

	it('writes the state into the query', () => {
		expect(importStateParams(state).toString()).toBe(
			new URLSearchParams({
				file: FILE,
				tab: 'spreadsheet',
				schema: SCHEMA,
				m: `${F1}:0,contact.latitude:3,contact.longitude:4`
			}).toString()
		);
	});

	it('round-trips through parseImportState', () => {
		expect(parseImportState(importStateParams(state))).toEqual(state);
	});

	it('round-trips a column that fills several fields', () => {
		const shared = { ...state, mapping: { [F1]: 0, 'contact.address_line_1': 0 } };

		expect(parseImportState(importStateParams(shared))).toEqual(shared);
	});

	it('round-trips a mapping with no columns', () => {
		const none = { ...state, mapping: {} };

		expect(parseImportState(importStateParams(none))).toEqual(none);
	});

	it('leaves out the default tab, no schema, and no mapping', () => {
		expect(
			importStateParams({ fileId: FILE, tab: 'mapping', schemaId: '', mapping: null }).toString()
		).toBe(`file=${FILE}`);
	});

	it("keeps parameters that are not the import's", () => {
		const next = importStateParams(state, params('page=2&q=ada'));

		expect(next.get('page')).toBe('2');
		expect(next.get('q')).toBe('ada');
		expect(next.get('file')).toBe(FILE);
	});

	it("replaces the import's old parameters instead of adding to them", () => {
		const next = importStateParams(
			{ fileId: FILE, tab: 'mapping', schemaId: '', mapping: null },
			params(`file=old&tab=spreadsheet&schema=${SCHEMA}&m=${F1}:0`)
		);

		expect(next.toString()).toBe(`file=${FILE}`);
	});

	it("removes only the import's parameters for a null state", () => {
		const next = importStateParams(null, params(`page=2&file=${FILE}&tab=spreadsheet&m=${F1}:0`));

		expect(next.toString()).toBe('page=2');
	});

	it('does not change the query it was given', () => {
		const current = params(`file=${FILE}`);
		importStateParams(null, current);

		expect(current.get('file')).toBe(FILE);
	});
});

describe('mappingFits', () => {
	const ids = [F1, F2, 'contact.latitude', 'contact.longitude'];

	it('fits when every field is one the caller lists and every column is in the file', () => {
		expect(mappingFits({ [F1]: 0, 'contact.latitude': 2, 'contact.longitude': 3 }, 4, ids)).toBe(
			true
		);
	});

	it('fits no mapping at all', () => {
		expect(mappingFits({}, 3, ids)).toBe(true);
	});

	it('lets one column fill several fields', () => {
		expect(mappingFits({ [F1]: 0, 'contact.latitude': 0 }, 3, ids)).toBe(true);
	});

	it('does not fit a column past the end of the file', () => {
		expect(mappingFits({ [F1]: 3 }, 3, ids)).toBe(false);
	});

	it('does not fit a negative or fractional column', () => {
		expect(mappingFits({ [F1]: -1 }, 3, ids)).toBe(false);
		expect(mappingFits({ [F1]: 1.5 }, 3, ids)).toBe(false);
	});

	it('does not fit a field the schema no longer has', () => {
		expect(mappingFits({ 'not-a-field': 0 }, 3, ids)).toBe(false);
	});

	it('does not fit a contact data field the caller did not list', () => {
		expect(mappingFits({ 'contact.city': 0 }, 3, ids)).toBe(false);
	});
});
