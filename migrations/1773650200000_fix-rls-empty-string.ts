import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Hardens RLS policies against empty-string app.current_org_id.
 *
 * On some connections (especially pooled ones), current_setting('app.current_org_id', true)
 * returns '' (empty string) rather than NULL when the setting has not been explicitly set
 * in the current session. Casting '' to uuid raises:
 *   "invalid input syntax for type uuid: "
 *
 * NULLIF(current_setting(..., true), '') converts '' → NULL, so the cast becomes
 * NULL::uuid = NULL, which safely returns no rows instead of throwing.
 */

const DIRECT_TABLES = [
	'survey',
	'turf',
	'plugin_installation',
	'survey_question',
	'turf_location',
	'turf_location_attempt',
	'survey_question_response',
	'turf_user'
] as const;

const ORG_ID_TABLES = ['org_role', 'org_user_role'] as const;

const safe = `NULLIF(current_setting('app.current_org_id', true), '')::uuid`;

export async function up(pgm: MigrationBuilder): Promise<void> {
	for (const table of DIRECT_TABLES) {
		pgm.sql(`DROP POLICY IF EXISTS org_isolation ON ${table}`);
		pgm.sql(`
			CREATE POLICY org_isolation ON ${table}
			USING (organization_id = ${safe})
			WITH CHECK (organization_id = ${safe})
		`);
	}

	for (const table of ORG_ID_TABLES) {
		pgm.sql(`DROP POLICY IF EXISTS org_isolation ON ${table}`);
		pgm.sql(`
			CREATE POLICY org_isolation ON ${table}
			USING (org_id = ${safe})
			WITH CHECK (org_id = ${safe})
		`);
	}

	pgm.sql(`DROP POLICY IF EXISTS location_visibility ON location`);
	pgm.sql(`
		CREATE POLICY location_visibility ON location
		USING (
			organization_id IS NULL
			OR organization_id = ${safe}
		)
		WITH CHECK (
			organization_id IS NULL
			OR organization_id = ${safe}
		)
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	const original = `current_setting('app.current_org_id', true)::uuid`;

	for (const table of DIRECT_TABLES) {
		pgm.sql(`DROP POLICY IF EXISTS org_isolation ON ${table}`);
		pgm.sql(`
			CREATE POLICY org_isolation ON ${table}
			USING (organization_id = ${original})
			WITH CHECK (organization_id = ${original})
		`);
	}

	for (const table of ORG_ID_TABLES) {
		pgm.sql(`DROP POLICY IF EXISTS org_isolation ON ${table}`);
		pgm.sql(`
			CREATE POLICY org_isolation ON ${table}
			USING (org_id = ${original})
			WITH CHECK (org_id = ${original})
		`);
	}

	pgm.sql(`DROP POLICY IF EXISTS location_visibility ON location`);
	pgm.sql(`
		CREATE POLICY location_visibility ON location
		USING (
			organization_id IS NULL
			OR organization_id = ${original}
		)
		WITH CHECK (
			organization_id IS NULL
			OR organization_id = ${original}
		)
	`);
}
