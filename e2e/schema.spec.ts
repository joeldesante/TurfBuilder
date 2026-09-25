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

/**
 * Org-scoped tables that are deliberately not under row-level security,
 * because they are read before any org is known. Adding to this list needs a
 * security review; queries against these tables must filter by org themselves.
 */
const RLS_EXEMPT = [
	// Looked up by token on /invite/[token], before the org is known.
	'public.org_invite_link',
	// Checked on /invite/[token] when the token is an org slug, before the org is known.
	'public.org_slug_invite'
];

test('every org-scoped table has row-level security enabled and forced', async () => {
	// Older tables name the column organization_id; universe tables use org_id.
	const { rows } = await db.query<{
		table_name: string;
		rls_enabled: boolean;
		rls_forced: boolean;
		policies: number;
	}>(
		`SELECT DISTINCT n.nspname || '.' || c.relname AS table_name,
		        c.relrowsecurity      AS rls_enabled,
		        c.relforcerowsecurity AS rls_forced,
		        (SELECT count(*)::int FROM pg_policies p
		         WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policies
		 FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 JOIN information_schema.columns col
		   ON col.table_schema = n.nspname AND col.table_name = c.relname
		 WHERE n.nspname IN ('public', 'universe')
		   AND c.relkind = 'r'
		   AND col.column_name IN ('organization_id', 'org_id')
		 ORDER BY 1`
	);

	const checked = rows.filter((row) => !RLS_EXEMPT.includes(row.table_name));
	expect(checked.length).toBeGreaterThan(0);
	expect(checked.map((row) => row.table_name)).toContain('universe.list_document');
	expect(
		checked
			.filter((row) => !row.rls_enabled || !row.rls_forced || row.policies === 0)
			.map((row) => row.table_name)
	).toEqual([]);

	// An exemption for a table that no longer exists, or that is now protected,
	// should be removed rather than linger.
	for (const table of RLS_EXEMPT) {
		const row = rows.find((r) => r.table_name === table);
		expect(row, `${table} is exempt but no longer exists`).toBeDefined();
		expect(row!.rls_enabled, `${table} now has RLS; drop its exemption`).toBe(false);
	}
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

// The row-level security check above only finds tables with an
// organization_id column; universe tables use org_id, so check this one directly.
test('list documents are org-isolated and can be soft-deleted', async () => {
	const table = await db.query<{ rls: boolean; forced: boolean }>(
		`SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
		 FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE n.nspname = 'universe' AND c.relname = 'list_document'`
	);
	expect(table.rows).toEqual([{ rls: true, forced: true }]);

	const policy = await db.query(
		`SELECT 1 FROM pg_policies
		 WHERE schemaname = 'universe' AND tablename = 'list_document' AND policyname = 'org_isolation'`
	);
	expect(policy.rowCount).toBe(1);

	const column = await db.query<{ data_type: string; is_nullable: string }>(
		`SELECT data_type, is_nullable FROM information_schema.columns
		 WHERE table_schema = 'universe' AND table_name = 'list_document' AND column_name = 'deleted_at'`
	);
	expect(column.rows).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
});

test('setup seeded the object storage settings', async () => {
	const { rows } = await db.query<{ key: string }>(
		`SELECT key FROM system_setting WHERE key LIKE 'spaces.%' ORDER BY key`
	);
	expect(rows.map((row) => row.key)).toEqual(['spaces.bucket', 'spaces.endpoint', 'spaces.region']);
});
