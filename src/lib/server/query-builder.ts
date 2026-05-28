import z from "zod";
import { POOL } from "$lib/server/database";

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

const JoinSchema: z.ZodType<JoinNode> = z.object({
	type: z.enum(['INNER', 'LEFT', 'RIGHT', 'FULL']),
	table: z.string().nonempty(),
	on: z.object({
		leftColumn: z.string().nonempty(),
		op: z.string().nonempty(),
		rightColumn: z.string().nonempty(),
	}),
});

// --- WHERE tree types ---

export type ConditionNode = {
	type: 'condition';
	column: string;
	op: string;
	negate: boolean;
	value?: any;
	value2?: any;  // BETWEEN upper bound
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
	column: z.string().nonempty(),
	op: z.string().nonempty(),
	negate: z.boolean().default(false),
	value: z.any().optional(),
	value2: z.any().optional(),
});

const GroupNodeSchema: z.ZodType<GroupNode> = z.lazy(() =>
	z.object({
		type: z.literal('group'),
		connector: z.enum(['AND', 'OR']),
		negate: z.boolean().default(false),
		children: z.array(z.union([ConditionNodeSchema, GroupNodeSchema])),
	})
);

const QueriesSchema = z.object({
	queries: z.object({
		select: z.string().nonempty().array().min(1),
		from: z.string().nonempty(),
		joins: JoinSchema.array().optional(),
		where: GroupNodeSchema.optional(),
	}).array().min(1)
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
	const parts = node.children
		.map(child => buildWhereNode(child, params))
		.filter(Boolean);

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

export async function runQueries(queries: Queries) {
	const sqlQueries = schemaToSqlQuery(queries);
	const results = await Promise.all(
		sqlQueries.map(q => POOL.query(q.query, q.parameters))
	);
	return results;
}
