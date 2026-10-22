export interface TableSize {
	/** Schema and table, such as `universe.org_entity`. */
	name: string;
	sizeBytes: number;
	/** The planner's row estimate; not exact. */
	estimatedRows: number;
}

export interface SystemHealth {
	runtime: {
		nodeVersion: string;
		uptimeSeconds: number;
		/** The commit this build came from, when the deploy sets GIT_SHA. */
		gitSha: string | null;
	};
	database: {
		postgresVersion: string;
		/** Null when PostGIS is not installed. */
		postgisVersion: string | null;
		sizeBytes: number;
		largestTables: TableSize[];
		pool: { total: number; idle: number; waiting: number };
	};
	status: {
		migrationNeeded: boolean;
		mailConfigured: boolean;
		storageConfigured: boolean;
		/** Whether PUPPETEER_EXECUTABLE_PATH points PDF generation at a browser. Otherwise Puppeteer uses its own download. */
		chromiumPathSet: boolean;
		emails24h: { sent: number; skipped: number; failed: number };
		failedDocuments24h: number;
	};
}
