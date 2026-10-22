import { Pool, type PoolClient } from 'pg';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

export const POOL = new Pool({
	connectionString: env.DATABASE_URL
});

export const AUTH_POOL = new Pool({
	connectionString: env.DATABASE_URL,
	options: '-c search_path=auth'
});

/** Queries and transactions slower than this are logged. LOG_SLOW_QUERY_MS overrides. */
const SLOW_MS = Number(process.env.LOG_SLOW_QUERY_MS) || 500;

/**
 * Logs any query that takes longer than SLOW_MS. Statements are parameterized
 * (values travel separately), so the text is safe to log; it is collapsed and
 * cut short so one line stays small.
 */
function logSlowQueries(pool: Pool, poolName: string) {
	pool.on('connect', (client) => {
		const original = client.query.bind(client) as (...args: unknown[]) => unknown;
		(client as { query: unknown }).query = (...args: unknown[]) => {
			const startedAt = performance.now();
			const result = original(...args);
			if (result instanceof Promise) {
				const report = (outcome: 'ok' | 'error') => () => {
					const durationMs = Math.round(performance.now() - startedAt);
					if (durationMs < SLOW_MS) return;
					const first = args[0];
					const text = typeof first === 'string' ? first : (first as { text?: string })?.text;
					logger.warn(
						{
							pool: poolName,
							durationMs,
							outcome,
							sql: text?.replace(/\s+/g, ' ').trim().slice(0, 160)
						},
						'Slow query'
					);
				};
				result.then(report('ok'), report('error'));
			}
			return result;
		};
	});
}

logSlowQueries(POOL, 'app');
logSlowQueries(AUTH_POOL, 'auth');

POOL.on('error', (err) => {
	logger.error({ err }, 'Unexpected Database Error');
});

process.on('SIGTERM', async () => {
	logger.info('SIGTERM received, flushing analytics and closing the database pool');
	// Imported here so the pool module does not load analytics until shutdown.
	const { shutdownAnalytics } = await import('$lib/server/analytics');
	await Promise.allSettled([shutdownAnalytics(), POOL.end()]);
	process.exit(0);
});

/**
 * Checks a connection out of the pool, logging when the wait was long. A long
 * wait means every connection is busy: the pool is the bottleneck, not a query.
 */
async function connect(): Promise<PoolClient> {
	const startedAt = performance.now();
	const client = await POOL.connect();
	const waitedMs = Math.round(performance.now() - startedAt);
	if (waitedMs >= SLOW_MS) {
		logger.warn(
			{ waitedMs, total: POOL.totalCount, idle: POOL.idleCount, waiting: POOL.waitingCount },
			'Slow database connection checkout'
		);
	}
	return client;
}

/**
 * Acquires a client, opens a transaction, and sets the org context for RLS.
 * All queries inside fn() are automatically scoped to the given org via the
 * app.current_org_id session variable, which RLS policies read.
 * The app-layer WHERE organization_id = $N filters remain in place as an
 * additional guard — RLS is defense-in-depth, not a replacement.
 */
import { z } from 'zod';

const uuidSchema = z.uuid();

export async function withOrgTransaction<T>(
	orgId: string,
	fn: (client: PoolClient) => Promise<T>
): Promise<T> {
	if (!uuidSchema.safeParse(orgId).success) {
		throw new Error(`withOrgTransaction: invalid orgId format`);
	}
	const client = await connect();
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

/**
 * Runs fn() in a plain transaction, for writes to tables without org RLS
 * (auth.*, the infra tables) that must land together, such as a change and
 * its audit row. Commits when fn resolves and rolls back when it throws.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await connect();
	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}
