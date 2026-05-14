import { POOL } from '$lib/server/database';

export interface ColumnSchema {
	name: string;
	type: string;
	nullable: boolean;
}

export interface TableSchema {
	schema: string;
	name: string;
	columns: ColumnSchema[];
}

/**
 * Returns column definitions for all tables and views in the given schemas,
 * pulled live from information_schema so it stays in sync with the database.
 */
export async function getTableSchemas(schemas: string[]): Promise<TableSchema[]> {
	const client = await POOL.connect();
	try {
		const result = await client.query<{
			table_schema: string;
			table_name: string;
			column_name: string;
			data_type: string;
			is_nullable: string;
		}>(
			`SELECT
				c.table_schema,
				c.table_name,
				c.column_name,
				c.data_type,
				c.is_nullable
			FROM information_schema.columns c
			JOIN information_schema.tables t
				ON c.table_schema = t.table_schema
				AND c.table_name = t.table_name
			WHERE c.table_schema = ANY($1)
			  AND t.table_type IN ('BASE TABLE', 'VIEW')
			ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
			[schemas]
		);

		const tableMap = new Map<string, TableSchema>();
		for (const row of result.rows) {
			const key = `${row.table_schema}.${row.table_name}`;
			if (!tableMap.has(key)) {
				tableMap.set(key, { schema: row.table_schema, name: row.table_name, columns: [] });
			}
			tableMap.get(key)!.columns.push({
				name: row.column_name,
				type: row.data_type,
				nullable: row.is_nullable === 'YES'
			});
		}

		return Array.from(tableMap.values());
	} finally {
		client.release();
	}
}
