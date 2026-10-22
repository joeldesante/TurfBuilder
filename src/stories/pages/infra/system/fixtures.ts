import type { SystemHealth } from '$lib/shared/types/system-health';

export const health: SystemHealth = {
	runtime: { nodeVersion: 'v24.9.0', uptimeSeconds: 93_600, gitSha: '098b26b' },
	database: {
		postgresVersion: '16.2',
		postgisVersion: '3.4',
		sizeBytes: 3.2 * 1024 ** 3,
		largestTables: [
			{ name: 'universe.org_entity', sizeBytes: 1.1 * 1024 ** 3, estimatedRows: 4_200_000 },
			{ name: 'public.activity_event', sizeBytes: 210 * 1024 ** 2, estimatedRows: 910_000 }
		],
		pool: { total: 6, idle: 5, waiting: 0 }
	},
	status: {
		migrationNeeded: false,
		mailConfigured: true,
		storageConfigured: true,
		chromiumPathSet: true,
		emails24h: { sent: 31, skipped: 0, failed: 0 },
		failedDocuments24h: 0
	}
};

export const permissions = ['access', 'settings.manage'];
