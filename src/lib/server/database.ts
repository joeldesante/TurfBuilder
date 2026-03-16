import { Pool, type PoolClient } from 'pg';
import { env } from '$env/dynamic/private';

export const POOL = new Pool({
	connectionString: env.DATABASE_URL
});

export const AUTH_POOL = new Pool({
	connectionString: env.DATABASE_URL,
	options: '-c search_path=auth'
});

POOL.on('error', (err) => {
	console.error('Unexpected Database Error:', err);
});

process.on('SIGTERM', async () => {
	await POOL.end();
	process.exit(0);
});

/**
 * Acquires a client, opens a transaction, and sets the org context for RLS.
 * All queries inside fn() are automatically scoped to the given org via the
 * app.current_org_id session variable, which RLS policies read.
 * The app-layer WHERE organization_id = $N filters remain in place as an
 * additional guard — RLS is defense-in-depth, not a replacement.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withOrgTransaction<T>(
	orgId: string,
	fn: (client: PoolClient) => Promise<T>
): Promise<T> {
	if (!UUID_RE.test(orgId)) {
		throw new Error(`withOrgTransaction: invalid orgId format`);
	}
	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		await client.query(`SET LOCAL app.current_org_id = '${orgId}'`);
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		// Reset the org context before returning to the pool so a reused
		// connection never leaks one org's data into another request.
		await client.query(`RESET app.current_org_id`).catch(() => {});
		client.release();
	}
}
