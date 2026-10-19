import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const PAGE_SIZE = 50;

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Entity references are foreign keys to the shared org_entity table, so the
 * schema alone shows no line from, say, a contact to its address. A column
 * named `<kind>_entity_id` that references org_entity really points at the
 * entity whose versions live in `org_<kind>` (address_entity_id ->
 * org_address.entity_id), so those are drawn as inferred edges. The inferred
 * edge needs both tables to exist; columns with no matching table (such as
 * from_org_entity_id) are left alone. Ids are negative so they cannot collide
 * with constraint ids.
 */
function inferEntityLinks(
	tables: Map<string, { columns: { name: string }[] }>,
	fks: { from: string; to: string; cols: string[] }[]
) {
	const inferred: {
		id: number;
		from: string;
		to: string;
		cols: string[];
		refCols: string[];
		inferred: true;
	}[] = [];
	for (const f of fks) {
		if (!f.to.endsWith('.org_entity') || f.cols.length !== 1) continue;
		const match = /^(.+)_entity_id$/.exec(f.cols[0]);
		if (!match) continue;
		const target = `${f.to.slice(0, f.to.indexOf('.'))}.org_${match[1]}`;
		if (!tables.get(target)?.columns.some((c) => c.name === 'entity_id')) continue;
		inferred.push({
			id: -(inferred.length + 1),
			from: f.from,
			to: target,
			cols: f.cols,
			refCols: ['entity_id'],
			inferred: true
		});
	}
	return inferred;
}

function createPool(): Pool {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set');

	// This tool bypasses the app's access checks, so it only talks to a local database.
	const host = new URL(url).hostname;
	if (!LOCAL_HOSTS.has(host) && process.env.DB_BROWSER_ALLOW_REMOTE !== '1') {
		throw new Error(`Refusing to browse ${host}. Set DB_BROWSER_ALLOW_REMOTE=1 to override.`);
	}
	return new Pool({ connectionString: url, max: 3 });
}

/** Every query runs in a read-only transaction with a timeout. */
async function readOnly<T>(pool: Pool, fn: (q: Pool['query']) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN READ ONLY');
		await client.query(`SET LOCAL statement_timeout = '10s'`);
		const result = await fn(client.query.bind(client) as Pool['query']);
		await client.query('ROLLBACK');
		return result;
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

interface Column {
	name: string;
	type: string;
	/** Full type for casts, e.g. `character varying(255)`. */
	ftype: string;
}

/** Confirms the table exists (so only real names reach the SQL text) and lists its columns. */
async function describe(q: Pool['query'], schema: string, name: string): Promise<Column[]> {
	const result = await q(
		`SELECT a.attname AS name, t.typname AS type, format_type(a.atttypid, a.atttypmod) AS ftype
		 FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
		 JOIN pg_type t ON t.oid = a.atttypid
		 WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p')
		 ORDER BY a.attnum`,
		[schema, name]
	);
	if (result.rows.length === 0) throw new HttpError(404, 'No such table');
	return result.rows;
}

/** Geometry columns come back as hex WKB, so select them as text. */
function selectList(columns: Column[]): string {
	return columns
		.map((c) =>
			c.type === 'geometry' || c.type === 'geography'
				? `ST_AsText(${quote(c.name)}) AS ${quote(c.name)}`
				: quote(c.name)
		)
		.join(', ');
}

class HttpError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

/** Columns the new-version form may change. The rest are copied or set by the tool. */
const FIXED = new Set(['id', 'entity_id', 'org_id', 'valid_from', 'valid_to', 'created_at']);

/** Value expression for a changed column; geometry arrives as (E)WKT text. */
function valueExpr(col: Column, n: number): string {
	if (col.type === 'geometry') return `ST_GeomFromEWKT($${n})`;
	if (col.type === 'geography') return `ST_GeomFromEWKT($${n})::geography`;
	return `$${n}::${col.ftype}`;
}

/**
 * Closes the entity's current version and inserts a new one copied from the
 * version `baseId`, with `changes` applied. Both share one now(), so there is
 * no gap or overlap.
 */
async function newVersion(
	pool: Pool,
	schema: string,
	name: string,
	baseId: string,
	changes: Record<string, string | null>
) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(`SET LOCAL statement_timeout = '10s'`);

		const columns = await describe(client.query.bind(client) as Pool['query'], schema, name);
		const has = (c: string) => columns.some((x) => x.name === c);
		if (!(has('entity_id') && has('valid_from') && has('valid_to'))) {
			throw new HttpError(400, 'Table is not versioned');
		}
		for (const key of Object.keys(changes)) {
			if (FIXED.has(key) || !has(key)) throw new HttpError(400, `Cannot change ${key}`);
		}

		const table = `${quote(schema)}.${quote(name)}`;
		const base = await client.query(`SELECT entity_id FROM ${table} WHERE id = $1 FOR UPDATE`, [
			baseId
		]);
		if (base.rows.length === 0) throw new HttpError(404, 'No such record');
		const entityId = base.rows[0].entity_id;

		await client.query(`SELECT 1 FROM ${table} WHERE entity_id = $1 FOR UPDATE`, [entityId]);
		await client.query(`UPDATE ${table} SET valid_to = now() WHERE entity_id = $1 AND valid_to IS NULL`, [
			entityId
		]);

		const insertCols = columns.filter((c) => !['id', 'valid_to', 'created_at'].includes(c.name));
		const params: (string | null)[] = [baseId];
		const exprs = insertCols.map((c) => {
			if (c.name === 'valid_from') return 'now()';
			if (!(c.name in changes)) return quote(c.name);
			params.push(changes[c.name]);
			return valueExpr(c, params.length);
		});

		const inserted = await client.query(
			`INSERT INTO ${table} (${insertCols.map((c) => quote(c.name)).join(', ')})
			 SELECT ${exprs.join(', ')} FROM ${table} WHERE id = $1
			 RETURNING id`,
			params
		);
		await client.query('COMMIT');
		return { id: inserted.rows[0].id };
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

async function readBody(req: IncomingMessage): Promise<any> {
	let raw = '';
	for await (const chunk of req) raw += chunk;
	try {
		return JSON.parse(raw);
	} catch {
		throw new HttpError(400, 'Invalid JSON');
	}
}

function send(res: ServerResponse, status: number, body: unknown) {
	res.statusCode = status;
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify(body));
}

export function dbApi(): Plugin {
	return {
		name: 'db-browser-api',
		configureServer(server) {
			const pool = createPool();
			server.httpServer?.on('close', () => pool.end());

			server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
				if (!req.url?.startsWith('/api/')) return next();
				const url = new URL(req.url, 'http://local');
				const param = (key: string) => url.searchParams.get(key) ?? '';

				try {
					if (url.pathname === '/api/tables') {
						const rows = await readOnly(
							pool,
							async (q) =>
								(
									await q(
										`SELECT n.nspname AS schema, c.relname AS name,
										   (SELECT count(*) FROM pg_attribute a
										    WHERE a.attrelid = c.oid AND NOT a.attisdropped
										      AND a.attname IN ('valid_from', 'valid_to')) = 2 AS temporal,
										   EXISTS (SELECT 1 FROM pg_attribute a
										    WHERE a.attrelid = c.oid AND NOT a.attisdropped
										      AND a.attname = 'entity_id') AS has_entity
										 FROM pg_class c
										 JOIN pg_namespace n ON n.oid = c.relnamespace
										 WHERE c.relkind IN ('r', 'p')
										   AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname NOT IN ('information_schema', 'topology', 'tiger', 'tiger_data')
										   AND c.relname <> 'spatial_ref_sys'
										 ORDER BY n.nspname, c.relname`
									)
								).rows
						);
						return send(
							res,
							200,
							rows.map((r) => ({
								schema: r.schema,
								name: r.name,
								temporal: r.temporal,
								versioned: r.temporal && r.has_entity
							}))
						);
					}

					if (url.pathname === '/api/schema') {
						const body = await readOnly(pool, async (q) => {
							const system = `n.nspname NOT LIKE 'pg\\_%' AND n.nspname NOT IN ('information_schema', 'topology', 'tiger', 'tiger_data')`;
							const columns = await q(
								`SELECT n.nspname AS schema, c.relname AS name, a.attname AS col, t.typname AS type,
								   EXISTS (SELECT 1 FROM pg_constraint p
								           WHERE p.conrelid = c.oid AND p.contype = 'p' AND a.attnum = ANY (p.conkey)) AS pk
								 FROM pg_class c
								 JOIN pg_namespace n ON n.oid = c.relnamespace
								 JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
								 JOIN pg_type t ON t.oid = a.atttypid
								 WHERE c.relkind IN ('r', 'p') AND ${system} AND c.relname <> 'spatial_ref_sys'
								 ORDER BY n.nspname, c.relname, a.attnum`
							);
							const fks = await q(
								`SELECT con.oid::int AS id, n.nspname AS schema, cl.relname AS name,
								   fn.nspname AS ref_schema, fcl.relname AS ref_name,
								   (SELECT array_agg(a.attname::text ORDER BY k.ord)
								    FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
								    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS cols,
								   (SELECT array_agg(a.attname::text ORDER BY k.ord)
								    FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
								    JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum) AS ref_cols
								 FROM pg_constraint con
								 JOIN pg_class cl ON cl.oid = con.conrelid
								 JOIN pg_namespace n ON n.oid = cl.relnamespace
								 JOIN pg_class fcl ON fcl.oid = con.confrelid
								 JOIN pg_namespace fn ON fn.oid = fcl.relnamespace
								 WHERE con.contype = 'f' AND ${system}`
							);
							return { columns: columns.rows, fks: fks.rows };
						});

						const tables = new Map<string, any>();
						for (const c of body.columns) {
							const key = `${c.schema}.${c.name}`;
							if (!tables.has(key)) {
								tables.set(key, { key, schema: c.schema, name: c.name, columns: [] });
							}
							tables.get(key).columns.push({ name: c.col, type: c.type, pk: c.pk });
						}
						const fks = body.fks
							.filter(
								(f: any) => tables.has(`${f.schema}.${f.name}`) && tables.has(`${f.ref_schema}.${f.ref_name}`)
							)
							.map((f: any) => ({
								id: f.id,
								from: `${f.schema}.${f.name}`,
								to: `${f.ref_schema}.${f.ref_name}`,
								cols: f.cols,
								refCols: f.ref_cols
							}));
						return send(res, 200, {
							tables: [...tables.values()],
							fks: [...fks, ...inferEntityLinks(tables, fks)]
						});
					}

					if (url.pathname === '/api/rows') {
						const schema = param('schema');
						const name = param('name');
						const page = Math.max(0, Number(param('page')) || 0);
						const current = param('current') === '1';

						const body = await readOnly(pool, async (q) => {
							const columns = await describe(q, schema, name);
							const has = (c: string) => columns.some((x) => x.name === c);
							const from = `${quote(schema)}.${quote(name)}`;
							const where = current && has('valid_to') ? 'WHERE valid_to IS NULL' : '';
							const order = has('valid_from')
								? 'ORDER BY valid_from DESC'
								: has('created_at')
									? 'ORDER BY created_at DESC'
									: 'ORDER BY ctid';

							const total = await q(`SELECT count(*)::int AS n FROM ${from} ${where}`);
							const rows = await q(
								`SELECT ${selectList(columns)} FROM ${from} ${where} ${order} LIMIT $1 OFFSET $2`,
								[PAGE_SIZE, page * PAGE_SIZE]
							);
							return {
								columns: columns.map((c) => c.name),
								rows: rows.rows,
								total: total.rows[0].n,
								pageSize: PAGE_SIZE
							};
						});
						return send(res, 200, body);
					}

					if (url.pathname === '/api/versions') {
						const schema = param('schema');
						const name = param('name');
						const entityId = param('entity_id');

						const body = await readOnly(pool, async (q) => {
							const columns = await describe(q, schema, name);
							if (!columns.some((c) => c.name === 'entity_id')) {
								throw new HttpError(400, 'Table has no entity_id');
							}
							const result = await q(
								`SELECT ${selectList(columns)} FROM ${quote(schema)}.${quote(name)}
								 WHERE entity_id = $1 ORDER BY valid_from DESC, created_at DESC`,
								[entityId]
							);
							return { columns: columns.map((c) => c.name), versions: result.rows };
						});
						return send(res, 200, body);
					}

					if (url.pathname === '/api/new-version' && req.method === 'POST') {
						const { schema, name, id, changes } = await readBody(req);
						return send(res, 200, await newVersion(pool, schema, name, id, changes ?? {}));
					}

					return send(res, 404, { error: 'Not found' });
				} catch (err) {
					const status = err instanceof HttpError ? err.status : 500;
					send(res, status, { error: err instanceof Error ? err.message : String(err) });
				}
			});
		}
	};
}
