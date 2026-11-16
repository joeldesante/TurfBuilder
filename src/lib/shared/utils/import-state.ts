import { isContactDataId } from './contact-data-fields';
import type { ColumnMapping } from './csv-mapping';

/** The dependency the import page's data is registered under, so it can be read again on its own. */
export const IMPORTS_KEY = 'app:contact-imports';

/** Where a person is in the contact import, kept in the page address so a reload picks up where they were. */
export interface ImportViewState {
	/** The uploaded file whose columns are being mapped. */
	fileId: string;
	tab: 'mapping' | 'spreadsheet';
	/** The schema chosen to import into, or an empty string for none yet. */
	schemaId: string;
	/**
	 * Which column fills each field: a schema field's id or a contact data field's id
	 * (`contact.latitude`) to the column's position from 0. Null when none was kept.
	 */
	mapping: ColumnMapping | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The parameters this state uses, so they can be cleared without touching the rest of the address. */
const KEYS = ['file', 'tab', 'schema', 'm'] as const;

/**
 * The import state held in an address's query, or null when there is none (a
 * missing or malformed file id). Anything else that is malformed falls back to
 * its default instead of failing, since a person can edit an address by hand.
 */
export function parseImportState(params: URLSearchParams): ImportViewState | null {
	const fileId = params.get('file');
	if (!fileId || !UUID.test(fileId)) return null;

	const schema = params.get('schema');
	const mapping = params.get('m');

	return {
		fileId,
		tab: params.get('tab') === 'spreadsheet' ? 'spreadsheet' : 'mapping',
		schemaId: schema && UUID.test(schema) ? schema : '',
		mapping: parseMapping(mapping)
	};
}

/**
 * The mapping in an address: `field:column` pairs, such as `contact.latitude:3`. A pair with
 * a field that is not one, or a column that is not a whole number, is dropped, since a person
 * can edit an address by hand. A mapping that is there but empty is kept as no columns.
 */
function parseMapping(raw: string | null): ColumnMapping | null {
	if (raw === null) return null;
	const mapping: ColumnMapping = {};
	for (const pair of raw.split(',')) {
		const [id, column, ...rest] = pair.split(':');
		if (rest.length > 0 || !/^\d+$/.test(column ?? '')) continue;
		if (!UUID.test(id) && !isContactDataId(id)) continue;
		mapping[id] = Number(column);
	}
	return mapping;
}

/**
 * The query with the import state written into it, keeping every parameter that
 * is not the import's. A null state removes the import's parameters, which is
 * what going back to the first step does. The mapping tab is the default, so it
 * is left out.
 */
export function importStateParams(
	state: ImportViewState | null,
	current: URLSearchParams = new URLSearchParams()
): URLSearchParams {
	const next = new URLSearchParams(current);
	for (const key of KEYS) next.delete(key);
	if (!state) return next;

	next.set('file', state.fileId);
	if (state.tab !== 'mapping') next.set('tab', state.tab);
	if (state.schemaId) next.set('schema', state.schemaId);
	if (state.mapping) {
		next.set(
			'm',
			Object.entries(state.mapping)
				.map(([id, column]) => `${id}:${column}`)
				.join(',')
		);
	}
	return next;
}

/**
 * Whether a kept mapping still fits: every field in it is one of `fieldIds` (the schema's
 * fields and the contact data fields, which the caller lists) and every column is a whole
 * number the file still has. A schema or a file can change after the address was saved, so
 * this is checked before the mapping is used.
 */
export function mappingFits(
	mapping: ColumnMapping,
	columnCount: number,
	fieldIds: readonly string[]
): boolean {
	return Object.entries(mapping).every(
		([id, column]) =>
			fieldIds.includes(id) && Number.isInteger(column) && column >= 0 && column < columnCount
	);
}
