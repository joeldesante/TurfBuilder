import { env } from '$env/dynamic/private';
import { POOL } from '$lib/server/database';
import { isMailConfigured } from '$lib/server/mail';
import { requireInfraPermission } from '$lib/server/permissions';
import { isStorageConfigured } from '$lib/server/storage';
import { emailLogTotals } from './email-log.service';
import { isMigrationNeeded } from './migrations.service';
import type { SystemHealth } from '$lib/shared/types/system-health';

/** "PostgreSQL 16.2 on x86_64..." as "16.2". */
function shortVersion(full: string): string {
	return /(\d+(?:\.\d+)+)/.exec(full)?.[1] ?? full;
}

/**
 * How the running instance is doing: runtime, database size and pool, and
 * whether the things the app depends on are set up. Each probe that can fail
 * degrades to an "unknown" value so one broken dependency does not hide the
 * rest. 403 without `access`.
 */
export async function getSystemHealth(userId: string): Promise<SystemHealth> {
	await requireInfraPermission(userId, 'access');

	const [version, postgis, size, tables, documents, migrationNeeded, mailConfigured, storageConfigured, emails] = await Promise.all([
		POOL.query<{ v: string }>(`SELECT version() AS v`),
		POOL.query<{ v: string }>(`SELECT postgis_version() AS v`).catch(() => null),
		POOL.query<{ bytes: string }>(`SELECT pg_database_size(current_database()) AS bytes`),
		// reltuples is -1 for a table never analyzed.
		POOL.query<{ name: string; bytes: string; rows: string }>(
			`SELECT n.nspname || '.' || c.relname AS name,
			        pg_total_relation_size(c.oid) AS bytes,
			        GREATEST(c.reltuples, 0)::bigint AS rows
			 FROM pg_class c
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
			 ORDER BY pg_total_relation_size(c.oid) DESC
			 LIMIT 15`
		),
		POOL.query<{ n: string }>(
			`SELECT COUNT(*) AS n FROM activity_event WHERE type = 'document.failed' AND occurred_at > now() - interval '24 hours'`
		),
		isMigrationNeeded().catch(() => true),
		isMailConfigured().catch(() => false),
		isStorageConfigured().catch(() => false),
		emailLogTotals(1)
	]);

	return {
		runtime: {
			nodeVersion: process.version,
			uptimeSeconds: Math.round(process.uptime()),
			gitSha: env.GIT_SHA || null
		},
		database: {
			postgresVersion: shortVersion(version.rows[0].v),
			postgisVersion: postgis?.rows[0]?.v ? shortVersion(postgis.rows[0].v) : null,
			sizeBytes: Number(size.rows[0].bytes),
			largestTables: tables.rows.map((r) => ({ name: r.name, sizeBytes: Number(r.bytes), estimatedRows: Number(r.rows) })),
			pool: { total: POOL.totalCount, idle: POOL.idleCount, waiting: POOL.waitingCount }
		},
		status: {
			migrationNeeded,
			mailConfigured,
			storageConfigured,
			chromiumPathSet: Boolean(env.PUPPETEER_EXECUTABLE_PATH),
			emails24h: emails,
			failedDocuments24h: Number(documents.rows[0].n)
		}
	};
}
