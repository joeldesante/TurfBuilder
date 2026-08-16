import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { DATABASE_URL } from './config';

let db: Client;

test.beforeAll(async () => {
	db = new Client({ connectionString: DATABASE_URL });
	await db.connect();
});

test.afterAll(async () => {
	await db?.end();
});

test('schemas and extensions exist', async () => {
	const schemas = await db.query<{ nspname: string }>(
		`SELECT nspname FROM pg_namespace WHERE nspname = ANY($1) ORDER BY nspname`,
		[['auth', 'public', 'universe']]
	);
	expect(schemas.rows.map((row) => row.nspname)).toEqual(['auth', 'public', 'universe']);

	const postgis = await db.query(`SELECT 1 FROM pg_extension WHERE extname = 'postgis'`);
	expect(postgis.rowCount).toBe(1);
});

test('every org-scoped table has row-level security enabled', async () => {
	const { rows } = await db.query<{ table_name: string; rls_enabled: boolean }>(
		`SELECT n.nspname || '.' || c.relname AS table_name,
		        c.relrowsecurity          AS rls_enabled
		 FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 JOIN information_schema.columns col
		   ON col.table_schema = n.nspname AND col.table_name = c.relname
		 WHERE n.nspname IN ('public', 'universe')
		   AND c.relkind = 'r'
		   AND col.column_name = 'organization_id'
		 ORDER BY 1`
	);

	expect(rows.length).toBeGreaterThan(0);
	expect(rows.filter((row) => !row.rls_enabled).map((row) => row.table_name)).toEqual([]);
});

test('setup seeded system settings', async () => {
	const { rows } = await db.query<{ key: string; value: string }>(
		`SELECT key, value FROM system_setting WHERE key = ANY($1) ORDER BY key`,
		[['application_name', 'base_url']]
	);
	expect(rows.map((row) => row.key)).toEqual(['application_name', 'base_url']);
	expect(rows.find((row) => row.key === 'base_url')?.value).toBe('http://localhost:5173');
});

test('setup created the admin user', async () => {
	const { rows } = await db.query<{ username: string; name: string }>(
		`SELECT username, name FROM auth.user WHERE email = $1`,
		['test@example.com']
	);
	expect(rows).toHaveLength(1);
	expect(rows[0].username).toBe('testmcgee');
	expect(rows[0].name).toBe('Test McGee');
});
