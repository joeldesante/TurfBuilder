import { env as privateEnv } from '$env/dynamic/private';

/**
 * Maintenance mode is an environment variable, not a system setting, on purpose:
 * a setting lives in the database, and the point of maintenance mode is that the
 * app stops touching the database. Only the exact text "true" turns it on.
 *
 * Read through `$env/dynamic/private`, not `process.env`: in development Vite
 * loads `.env` into `$env` only, so `process.env` would never see it. In
 * production `$env/dynamic/private` reads the real environment.
 */
export function isMaintenanceMode(env: Record<string, string | undefined> = privateEnv): boolean {
	return env.MAINTENANCE_MODE?.trim().toLowerCase() === 'true';
}
