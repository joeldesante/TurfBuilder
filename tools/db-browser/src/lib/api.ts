export interface TableInfo {
	schema: string;
	name: string;
	temporal: boolean;
	versioned: boolean;
}

export type Row = Record<string, unknown>;

export interface RowsPage {
	columns: string[];
	rows: Row[];
	total: number;
	pageSize: number;
}

export interface Versions {
	columns: string[];
	versions: Row[];
}

export interface GraphColumn {
	name: string;
	type: string;
	pk: boolean;
}

export interface GraphTable {
	key: string;
	schema: string;
	name: string;
	columns: GraphColumn[];
}

export interface GraphFk {
	id: number;
	from: string;
	to: string;
	cols: string[];
	refCols: string[];
}

export interface SchemaGraph {
	tables: GraphTable[];
	fks: GraphFk[];
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
	const res = await fetch(`${path}?${new URLSearchParams(params)}`);
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? res.statusText);
	return body;
}

export const getSchema = () => get<SchemaGraph>('/api/schema');

export const listTables = () => get<TableInfo[]>('/api/tables');

export const listRows = (t: TableInfo, page: number, current: boolean) =>
	get<RowsPage>('/api/rows', {
		schema: t.schema,
		name: t.name,
		page: String(page),
		current: current ? '1' : '0'
	});

export const listVersions = (t: TableInfo, entityId: string) =>
	get<Versions>('/api/versions', { schema: t.schema, name: t.name, entity_id: entityId });

export async function newVersion(
	t: TableInfo,
	id: string,
	changes: Record<string, string | null>
): Promise<{ id: string }> {
	const res = await fetch('/api/new-version', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ schema: t.schema, name: t.name, id, changes })
	});
	const body = await res.json();
	if (!res.ok) throw new Error(body.error ?? res.statusText);
	return body;
}

export function display(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}
