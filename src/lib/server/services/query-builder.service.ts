import z from 'zod';
import { POOL } from '$lib/server/database';
import { requireInfraPermission } from '$lib/server/permissions';

// --- Join type ---

export type JoinNode = {
	type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
	table: string;
	on: {
		leftColumn: string;
		op: string;
		rightColumn: string;
	};
};

// Table, column, and operator names are written into the SQL as they are, so
// each must be a plain identifier from this short list of shapes; anything
// else is refused before a query is built. Values always go in as parameters.

/** A table in one of the schemas the query builder shows: `universe.turf`. */
const TABLE = /^(universe|public)\.[a-z_][a-z0-9_]*$/;
/** A column, optionally qualified (`turf.code`, `universe.turf.code`), or `*` / `turf.*`. */
const COLUMN = /^(\*|([a-z_][a-z0-9_]*\.){0,2}([a-z_][a-z0-9_]*|\*))$/;
const COMPARISONS = ['=', '!=', '<', '>', '<=', '>='] as const;
const CONDITIONS = [
	...COMPARISONS,
	'LIKE',
	'ILIKE',
	'IN',
	'BETWEEN',
	'IS NULL',
	'IS NOT NULL'
] as const;

const tableName = z.string().regex(TABLE, 'Unknown table.');
const columnName = z.string().regex(COLUMN, 'Invalid column.');

const JoinSchema: z.ZodType<JoinNode> = z.object({
	type: z.enum(['INNER', 'LEFT', 'RIGHT', 'FULL']),
	table: tableName,
	on: z.object({
		leftColumn: columnName,
		op: z.enum(COMPARISONS),
		rightColumn: columnName
	})
});

// --- WHERE tree types ---

export type ConditionNode = {
	type: 'condition';
	column: string;
	op: string;
	negate: boolean;
	value?: any;
	value2?: any; // BETWEEN upper bound
};

export type GroupNode = {
	type: 'group';
	connector: 'AND' | 'OR';
	negate: boolean;
	children: WhereNode[];
};

export type WhereNode = ConditionNode | GroupNode;

/** A single query inside the Queries wrapper. */
export type SingleQuery = {
	select: string[];
	from: string;
	joins?: JoinNode[];
	where?: GroupNode;
};

// --- Zod schemas ---

const ConditionNodeSchema: z.ZodType<ConditionNode> = z.object({
	type: z.literal('condition'),
	column: columnName,
	op: z.enum(CONDITIONS),
	negate: z.boolean().default(false),
	value: z.any().optional(),
	value2: z.any().optional()
});

const GroupNodeSchema: z.ZodType<GroupNode> = z.lazy(() =>
	z.object({
		type: z.literal('group'),
		connector: z.enum(['AND', 'OR']),
		negate: z.boolean().default(false),
		children: z.array(z.union([ConditionNodeSchema, GroupNodeSchema]))
	})
);

const QueriesSchema = z.object({
	queries: z
		.object({
			select: columnName.array().min(1),
			from: tableName,
			joins: JoinSchema.array().optional(),
			where: GroupNodeSchema.optional()
		})
		.array()
		.min(1)
});

export type Queries = z.infer<typeof QueriesSchema>;

interface SqlQuery {
	query: string;
	parameters: any[];
}

// --- Recursive WHERE builder ---

export function buildWhereNode(node: WhereNode, params: any[]): string {
	if (node.type === 'condition') {
		const startIdx = params.length + 1;
		let sql: string;

		if (node.op === 'IN') {
			const values = Array.isArray(node.value) ? node.value : [node.value];
			const placeholders = values.map((_: any, i: number) => `$${startIdx + i}`).join(', ');
			sql = `${node.column} IN (${placeholders})`;
			params.push(...values);
		} else if (node.op === 'BETWEEN') {
			sql = `${node.column} BETWEEN $${startIdx} AND $${startIdx + 1}`;
			params.push(node.value, node.value2);
		} else if (node.op === 'IS NULL' || node.op === 'IS NOT NULL') {
			// No parameter for null-check operators
			sql = `${node.column} ${node.op}`;
		} else {
			sql = `${node.column} ${node.op} $${startIdx}`;
			params.push(node.value);
		}

		return node.negate ? `NOT (${sql})` : sql;
	}

	// group node
	const parts = node.children.map((child) => buildWhereNode(child, params)).filter(Boolean);

	if (parts.length === 0) return '';

	const inner = parts.join(` ${node.connector} `);
	const grouped = parts.length > 1 ? `(${inner})` : inner;
	return node.negate ? `NOT ${grouped}` : grouped;
}

// --- Public API ---

export function schemaToSqlQuery(schema: Queries): SqlQuery[] {
	QueriesSchema.parse(schema);

	return schema.queries.map((query) => {
		const columns = query.select.join(', ');
		const params: any[] = [];

		let q = `SELECT ${columns} FROM ${query.from}`;

		for (const join of query.joins ?? []) {
			q += ` ${join.type} JOIN ${join.table} ON ${join.on.leftColumn} ${join.on.op} ${join.on.rightColumn}`;
		}

		if (query.where) {
			const whereStr = buildWhereNode(query.where, params);
			if (whereStr) q += ` WHERE ${whereStr}`;
		}

		return { query: q + ';', parameters: params };
	});
}

/**
 * Runs raw read queries across every organization's rows, so only infra
 * admins may (403 for anyone else). 400 for a malformed query.
 */
export async function runQueries(userId: string, queries: Queries) {
	await requireInfraPermission(userId, 'access');
	const parsed = QueriesSchema.safeParse(queries);
	if (!parsed.success) throw new QueryError(parsed.error.issues[0]?.message ?? 'Invalid query.');
	const sqlQueries = schemaToSqlQuery(queries);
	const results = await Promise.all(sqlQueries.map((q) => POOL.query(q.query, q.parameters)));
	return results;
}

/** A query the builder refused; the message is safe to show. */
export class QueryError extends Error {}

/** The tables and columns the query builder offers. Infra admins only. */
export async function getQueryBuilderSchemas(userId: string): Promise<TableSchema[]> {
	await requireInfraPermission(userId, 'access');
	return getTableSchemas(['universe', 'public']);
}

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
