import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Enables PostgreSQL Row-Level Security on all org-scoped tables.
 *
 * This migration requires the application to connect as a non-superuser role
 * (turfbuilder_app). Superusers bypass RLS. Update DATABASE_URL accordingly
 * before running this in production.
 *
 * Create the role first:
 *   CREATE ROLE turfbuilder_app WITH LOGIN PASSWORD '...';
 *   GRANT CONNECT ON DATABASE <db> TO turfbuilder_app;
 *   GRANT USAGE ON SCHEMA public TO turfbuilder_app;
 *   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO turfbuilder_app;
 *   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO turfbuilder_app;
 *
 * The app-layer WHERE organization_id = $N filters remain in place — RLS is
 * defense-in-depth, not a replacement. A connection that does not set
 * app.current_org_id will see zero rows on all protected tables (safe-fail).
 */

// Tables with a direct organization_id column.
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

// Tables that use org_id instead of organization_id.
const ORG_ID_TABLES = ['org_role', 'org_user_role'] as const;

export async function up(pgm: MigrationBuilder): Promise<void> {
	// Direct organization_id tables.
	for (const table of DIRECT_TABLES) {
		pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
		pgm.sql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
		pgm.sql(`
			CREATE POLICY org_isolation ON ${table}
			USING (organization_id = current_setting('app.current_org_id', true)::uuid)
			WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid)
		`);
	}

	// org_id-keyed tables (org_role, org_user_role).
	for (const table of ORG_ID_TABLES) {
		pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
		pgm.sql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
		pgm.sql(`
			CREATE POLICY org_isolation ON ${table}
			USING (org_id = current_setting('app.current_org_id', true)::uuid)
			WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
		`);
	}

	// location: two-tier policy — global rows (organization_id IS NULL) are
	// visible to everyone; org-private rows are visible only to their org.
	pgm.sql(`ALTER TABLE location ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE location FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY location_visibility ON location
		USING (
			organization_id IS NULL
			OR organization_id = current_setting('app.current_org_id', true)::uuid
		)
		WITH CHECK (
			organization_id IS NULL
			OR organization_id = current_setting('app.current_org_id', true)::uuid
		)
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	for (const table of [...DIRECT_TABLES, ...ORG_ID_TABLES]) {
		pgm.sql(`DROP POLICY IF EXISTS org_isolation ON ${table}`);
		pgm.sql(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
	}

	pgm.sql(`DROP POLICY IF EXISTS location_visibility ON location`);
	pgm.sql(`ALTER TABLE location DISABLE ROW LEVEL SECURITY`);
}
