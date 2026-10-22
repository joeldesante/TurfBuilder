import { createHash } from 'node:crypto';
import { POOL } from '$lib/server/database';
import { SETUP_STEPS } from '$lib/server/setup-schema';

const FINGERPRINT_KEY = 'schema.fingerprint';

/** A hash of every schema statement this build runs. Changes whenever the schema does. */
export function schemaFingerprint(): string {
	return createHash('sha256').update(JSON.stringify(SETUP_STEPS)).digest('hex').slice(0, 16);
}

/** Stores the running build's fingerprint after a migration finishes. */
export async function recordSchemaFingerprint(): Promise<void> {
	await POOL.query(
		`INSERT INTO system_setting (key, value, description)
		 VALUES ($1, $2, 'Fingerprint of the schema the last migration applied. Set by /infra/migrate.')
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
		[FINGERPRINT_KEY, schemaFingerprint()]
	);
}

/**
 * Whether this build has schema changes the database has not had yet: the
 * stored fingerprint is missing or from another build.
 */
export async function isMigrationNeeded(): Promise<boolean> {
	const result = await POOL.query<{ value: string }>(`SELECT value FROM system_setting WHERE key = $1`, [
		FINGERPRINT_KEY
	]);
	return result.rows[0]?.value !== schemaFingerprint();
}
