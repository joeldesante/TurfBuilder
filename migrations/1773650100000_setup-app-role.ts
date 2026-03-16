import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Creates the turfbuilder_app PostgreSQL role and grants it the minimum
 * privileges needed to run the application.
 *
 * This role is intentionally NOT a superuser so that Row-Level Security
 * policies are enforced. Superusers bypass RLS entirely.
 *
 * DATABASE_URL in .env (and in production config) must point to this role.
 * MIGRATION_DATABASE_URL must point to the superuser (postgres) so that
 * this migration and any DDL migrations can run.
 *
 * IMPORTANT: Before deploying to production, set a strong password by
 * running (as superuser):
 *   ALTER ROLE turfbuilder_app PASSWORD '<strong-password>';
 * Then update DATABASE_URL accordingly.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
	// Create role if it doesn't already exist (idempotent for existing environments).
	pgm.sql(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'turfbuilder_app') THEN
				CREATE ROLE turfbuilder_app WITH LOGIN PASSWORD 'password';
			END IF;
		END
		$$
	`);

	// Allow the role to connect to this database.
	pgm.sql(`
		DO $$
		BEGIN
			EXECUTE 'GRANT CONNECT ON DATABASE ' || quote_ident(current_database()) || ' TO turfbuilder_app';
		END
		$$
	`);

	// ---- public schema (app tables) ----
	pgm.sql(`GRANT USAGE ON SCHEMA public TO turfbuilder_app`);
	pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO turfbuilder_app`);
	pgm.sql(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO turfbuilder_app`);
	// Ensure future tables/sequences created by migrations are also accessible.
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO turfbuilder_app`);
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO turfbuilder_app`);

	// ---- auth schema (better-auth tables: user, session, account, organization, member, etc.) ----
	pgm.sql(`GRANT USAGE ON SCHEMA auth TO turfbuilder_app`);
	pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO turfbuilder_app`);
	pgm.sql(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO turfbuilder_app`);
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO turfbuilder_app`);
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT USAGE, SELECT ON SEQUENCES TO turfbuilder_app`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	// Revoke default privilege rules first.
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA auth REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM turfbuilder_app`);
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA auth REVOKE USAGE, SELECT ON SEQUENCES FROM turfbuilder_app`);
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM turfbuilder_app`);
	pgm.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM turfbuilder_app`);

	// Revoke existing grants.
	pgm.sql(`REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM turfbuilder_app`);
	pgm.sql(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM turfbuilder_app`);
	pgm.sql(`REVOKE USAGE ON SCHEMA auth FROM turfbuilder_app`);
	pgm.sql(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM turfbuilder_app`);
	pgm.sql(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM turfbuilder_app`);
	pgm.sql(`REVOKE USAGE ON SCHEMA public FROM turfbuilder_app`);

	// Note: the role itself is not dropped here because it may still own objects
	// or be referenced elsewhere. Drop manually if needed:
	//   DROP ROLE turfbuilder_app;
}
