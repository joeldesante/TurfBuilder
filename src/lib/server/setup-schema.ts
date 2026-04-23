export interface SetupStep {
	label: string;
	statements: string[];
}

const safe = `NULLIF(current_setting('app.current_org_id', true), '')::uuid`;

export const SETUP_STEPS: SetupStep[] = [
	// -------------------------------------------------------------------------
	// 1. Extensions
	// -------------------------------------------------------------------------
	{
		label: 'Installing PostgreSQL extensions',
		statements: [
			`CREATE EXTENSION IF NOT EXISTS postgis`,
			`CREATE EXTENSION IF NOT EXISTS postgis_topology`
		]
	},

	// -------------------------------------------------------------------------
	// 2. Auth schema
	// -------------------------------------------------------------------------
	{
		label: 'Creating auth schema',
		statements: [`CREATE SCHEMA IF NOT EXISTS auth`]
	},

	// -------------------------------------------------------------------------
	// 3. Auth tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating auth tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS auth.user (
				id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name          TEXT NOT NULL,
				username      TEXT NOT NULL,
				display_username TEXT NOT NULL,
				email         TEXT NOT NULL,
				email_verified BOOLEAN NOT NULL,
				image         TEXT,
				two_factor_enabled BOOLEAN,
				role          TEXT,
				banned        BOOLEAN,
				ban_reason    TEXT,
				ban_expires   TIMESTAMP,
				impersonated_by UUID REFERENCES auth.user(id) ON DELETE SET NULL ON UPDATE CASCADE,
				created_at    TIMESTAMP NOT NULL DEFAULT now(),
				updated_at    TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE auth.user ADD CONSTRAINT user_username_unique UNIQUE (username);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`DO $$ BEGIN
				ALTER TABLE auth.user ADD CONSTRAINT user_email_unique UNIQUE (email);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS auth.account (
				id                      UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id                 UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				account_id              TEXT NOT NULL,
				provider_id             TEXT NOT NULL,
				access_token            TEXT,
				refresh_token           TEXT,
				access_token_expires_at TIMESTAMP,
				refresh_token_expires_at TIMESTAMP,
				scope                   TEXT,
				id_token                TEXT,
				password                TEXT,
				created_at              TIMESTAMP NOT NULL DEFAULT now(),
				updated_at              TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE auth.account ADD CONSTRAINT account_provider_account_unique UNIQUE (provider_id, account_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS auth.verification (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				identifier TEXT NOT NULL,
				value      TEXT NOT NULL,
				expires_at TIMESTAMP NOT NULL DEFAULT now(),
				created_at TIMESTAMP NOT NULL DEFAULT now(),
				updated_at TIMESTAMP NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS auth.two_factor (
				id           UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id      UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				secret       TEXT,
				backup_codes TEXT
			)`,

			`CREATE TABLE IF NOT EXISTS auth.organization (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name       TEXT NOT NULL,
				slug       TEXT NOT NULL,
				logo       TEXT,
				metadata   TEXT,
				created_at TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE auth.organization ADD CONSTRAINT organization_slug_unique UNIQUE (slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS auth.session (
				id                     UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id                UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				token                  TEXT NOT NULL,
				ip_address             TEXT,
				user_agent             TEXT,
				active_organization_id UUID REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				expires_at             TIMESTAMP NOT NULL DEFAULT now(),
				created_at             TIMESTAMP NOT NULL DEFAULT now(),
				updated_at             TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE auth.session ADD CONSTRAINT session_token_unique UNIQUE (token);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS auth.invitation (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				email           TEXT NOT NULL,
				inviter_id      UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				role            TEXT,
				status          TEXT,
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS auth.member (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id         UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				role            TEXT NOT NULL,
				created_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE auth.member ADD CONSTRAINT member_user_org_unique UNIQUE (user_id, organization_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`
		]
	},

	// -------------------------------------------------------------------------
	// 4. Geometry helper function
	// -------------------------------------------------------------------------
	{
		label: 'Creating geometry functions',
		statements: [
			`CREATE OR REPLACE FUNCTION update_geometry() RETURNS trigger AS $$
			BEGIN
				NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql`
		]
	},

	// -------------------------------------------------------------------------
	// 5. perm_scope enum
	// -------------------------------------------------------------------------
	{
		label: 'Creating permission scope enum',
		statements: [
			`DO $$ BEGIN
				CREATE TYPE perm_scope AS ENUM ('organization', 'infrastructure');
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`
		]
	},

	// -------------------------------------------------------------------------
	// 6. Core app tables: survey, survey_question, turf, location
	// -------------------------------------------------------------------------
	{
		label: 'Creating survey and turf tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS survey (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name            TEXT NOT NULL,
				description     TEXT,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS survey_org_id_idx ON survey (organization_id)`,

			`CREATE TABLE IF NOT EXISTS survey_question (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				survey_id       UUID NOT NULL REFERENCES survey(id) ON DELETE CASCADE ON UPDATE CASCADE,
				question_text   TEXT NOT NULL,
				question_type   TEXT NOT NULL,
				order_index     INTEGER NOT NULL DEFAULT 0,
				choices         TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS survey_question_org_id_idx ON survey_question (organization_id)`,

			`CREATE TABLE IF NOT EXISTS turf (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				code            TEXT NOT NULL,
				author_id       UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				survey_id       UUID REFERENCES survey(id) ON DELETE CASCADE ON UPDATE CASCADE,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				bounds          geometry,
				expires_at      TIMESTAMP NOT NULL DEFAULT now(),
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE turf ADD CONSTRAINT turf_code_unique UNIQUE (code);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS turf_org_id_idx ON turf (organization_id)`,

			`CREATE TABLE IF NOT EXISTS location (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				location_name   TEXT,
				category        TEXT,
				confidence      TEXT,
				street          TEXT,
				locality        TEXT,
				postcode        TEXT,
				region          TEXT,
				country         TEXT,
				latitude        NUMERIC(10,8) NOT NULL,
				longitude       NUMERIC(11,8) NOT NULL,
				geom            geometry(point, 4326),
				organization_id UUID REFERENCES auth.organization(id) ON DELETE CASCADE,
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS locations_category_idx  ON location (category)`,
			`CREATE INDEX IF NOT EXISTS locations_confidence_idx ON location (confidence)`,
			`CREATE INDEX IF NOT EXISTS locations_geom_idx       ON location USING gist (geom)`,
			`CREATE INDEX IF NOT EXISTS locations_locality_idx   ON location (locality)`,
			`CREATE INDEX IF NOT EXISTS location_org_id_idx      ON location (organization_id)`,
			`DROP TRIGGER IF EXISTS locations_geom_trigger ON location`,
			`CREATE TRIGGER locations_geom_trigger
				BEFORE INSERT OR UPDATE ON location
				FOR EACH ROW EXECUTE FUNCTION update_geometry()`
		]
	},

	// -------------------------------------------------------------------------
	// 7. org_location (Tier 2 private locations)
	// -------------------------------------------------------------------------
	{
		label: 'Creating org_location table',
		statements: [
			`CREATE TABLE IF NOT EXISTS org_location (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				location_name   TEXT,
				category        TEXT,
				confidence      TEXT,
				street          TEXT,
				locality        TEXT,
				postcode        TEXT,
				region          TEXT,
				country         TEXT,
				latitude        NUMERIC(10,8) NOT NULL,
				longitude       NUMERIC(11,8) NOT NULL,
				geom            geometry(point, 4326),
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS org_location_org_id_idx   ON org_location (organization_id)`,
			`CREATE INDEX IF NOT EXISTS org_location_category_idx ON org_location (category)`,
			`CREATE INDEX IF NOT EXISTS org_location_geom_idx     ON org_location USING gist (geom)`,
			`DROP TRIGGER IF EXISTS org_location_geom_trigger ON org_location`,
			`CREATE TRIGGER org_location_geom_trigger
				BEFORE INSERT OR UPDATE ON org_location
				FOR EACH ROW EXECUTE FUNCTION update_geometry()`
		]
	},

	// -------------------------------------------------------------------------
	// 8. Turf-location join tables and canvassing tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating canvassing tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS turf_location (
				id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				turf_id          UUID NOT NULL REFERENCES turf(id) ON DELETE CASCADE ON UPDATE CASCADE,
				location_id      UUID REFERENCES location(id) ON DELETE CASCADE ON UPDATE CASCADE,
				org_location_id  UUID REFERENCES org_location(id) ON DELETE CASCADE,
				organization_id  UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				created_at       TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE turf_location ADD CONSTRAINT turf_location_tier_check CHECK (
					(location_id IS NOT NULL AND org_location_id IS NULL) OR
					(location_id IS NULL AND org_location_id IS NOT NULL)
				);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE UNIQUE INDEX IF NOT EXISTS turf_location_tier1_unique
				ON turf_location (turf_id, location_id) WHERE location_id IS NOT NULL`,
			`CREATE UNIQUE INDEX IF NOT EXISTS turf_location_tier2_unique
				ON turf_location (turf_id, org_location_id) WHERE org_location_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS turf_location_org_id_idx          ON turf_location (organization_id)`,
			`CREATE INDEX IF NOT EXISTS turf_location_org_location_id_idx ON turf_location (org_location_id)`,

			`CREATE TABLE IF NOT EXISTS turf_location_attempt (
				id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				turf_location_id UUID NOT NULL REFERENCES turf_location(id) ON DELETE CASCADE ON UPDATE CASCADE,
				user_id          UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				organization_id  UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				attempt_note     TEXT,
				contact_made     BOOLEAN,
				created_at       TIMESTAMP NOT NULL DEFAULT now(),
				updated_at       TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE turf_location_attempt ADD CONSTRAINT turf_location_user_unique
					UNIQUE (turf_location_id, user_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS turf_location_attempt_org_id_idx ON turf_location_attempt (organization_id)`,

			`CREATE TABLE IF NOT EXISTS survey_question_response (
				id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				response_value           TEXT,
				survey_question_id       UUID NOT NULL REFERENCES survey_question(id) ON DELETE CASCADE ON UPDATE CASCADE,
				turf_location_attempt_id UUID NOT NULL REFERENCES turf_location_attempt(id) ON DELETE CASCADE ON UPDATE CASCADE,
				organization_id          UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				created_at               TIMESTAMP NOT NULL DEFAULT now(),
				updated_at               TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE survey_question_response ADD CONSTRAINT survey_question_response_unique
					UNIQUE (survey_question_id, turf_location_attempt_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS survey_question_response_org_id_idx ON survey_question_response (organization_id)`,

			`CREATE TABLE IF NOT EXISTS turf_user (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				turf_id         UUID NOT NULL REFERENCES turf(id) ON DELETE CASCADE ON UPDATE CASCADE,
				user_id         UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE
			)`,
			`DO $$ BEGIN
				ALTER TABLE turf_user ADD CONSTRAINT turf_user_unique UNIQUE (turf_id, user_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS turf_user_org_id_idx ON turf_user (organization_id)`
		]
	},

	// -------------------------------------------------------------------------
	// 9. Plugin and invite tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating plugin and invite tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS plugin_installation (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				plugin_slug     TEXT NOT NULL,
				enabled         BOOLEAN NOT NULL DEFAULT true,
				config          JSONB NOT NULL DEFAULT '{}',
				installed_by    UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE plugin_installation ADD CONSTRAINT plugin_installation_org_slug_unique
					UNIQUE (organization_id, plugin_slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS plugin_installation_org_id_idx ON plugin_installation (organization_id)`,

			`CREATE TABLE IF NOT EXISTS org_invite_link (
				id         TEXT PRIMARY KEY NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				created_by UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				expires_at TIMESTAMP,
				created_at TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS org_invite_link_org_id_idx ON org_invite_link (org_id)`,

			`CREATE TABLE IF NOT EXISTS org_slug_invite (
				org_id  UUID PRIMARY KEY NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				enabled BOOLEAN NOT NULL DEFAULT false
			)`
		]
	},

	// -------------------------------------------------------------------------
	// 10. Permission system tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating permission system tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS registered_permission (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				key         TEXT NOT NULL,
				name        TEXT NOT NULL,
				description TEXT NOT NULL,
				scope       perm_scope NOT NULL,
				created_at  TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE registered_permission ADD CONSTRAINT registered_permission_scope_key_unique
					UNIQUE (scope, key);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS permission_role (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name            TEXT NOT NULL,
				weight          INTEGER NOT NULL DEFAULT 100,
				scope           perm_scope NOT NULL,
				organization_id UUID REFERENCES auth.organization(id) ON DELETE CASCADE,
				is_default      BOOLEAN NOT NULL DEFAULT false,
				created_at      TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE permission_role ADD CONSTRAINT permission_role_org_id_check
					CHECK (scope = 'infrastructure' OR organization_id IS NOT NULL);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE UNIQUE INDEX IF NOT EXISTS permission_role_org_weight_unique
				ON permission_role (organization_id, weight) WHERE scope = 'organization'`,
			`CREATE UNIQUE INDEX IF NOT EXISTS permission_role_infra_weight_unique
				ON permission_role (weight) WHERE scope = 'infrastructure'`,
			`CREATE INDEX IF NOT EXISTS perm_role_org_id_idx ON permission_role (organization_id)`,

			`CREATE TABLE IF NOT EXISTS permission_role_entry (
				id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				role_id                  UUID NOT NULL REFERENCES permission_role(id) ON DELETE CASCADE,
				registered_permission_id UUID NOT NULL REFERENCES registered_permission(id) ON DELETE CASCADE,
				value                    BOOLEAN NOT NULL DEFAULT true
			)`,
			`DO $$ BEGIN
				ALTER TABLE permission_role_entry ADD CONSTRAINT pre_role_perm_unique
					UNIQUE (role_id, registered_permission_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS user_role_membership (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id    UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				member_id  UUID REFERENCES auth.member(id) ON DELETE CASCADE,
				role_id    UUID NOT NULL REFERENCES permission_role(id) ON DELETE CASCADE,
				granted_by UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE user_role_membership ADD CONSTRAINT urm_user_role_unique
					UNIQUE (user_id, role_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS ugm_user_id_idx  ON user_role_membership (user_id)`,
			`CREATE INDEX IF NOT EXISTS ugm_member_id_idx ON user_role_membership (member_id)`,
			`CREATE INDEX IF NOT EXISTS urm_role_id_idx  ON user_role_membership (role_id)`,

			`CREATE TABLE IF NOT EXISTS user_permission (
				id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id                  UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				member_id                UUID REFERENCES auth.member(id) ON DELETE CASCADE,
				registered_permission_id UUID NOT NULL REFERENCES registered_permission(id) ON DELETE CASCADE,
				organization_id          UUID REFERENCES auth.organization(id) ON DELETE CASCADE,
				value                    BOOLEAN NOT NULL DEFAULT true,
				granted_by               UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at               TIMESTAMP NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE user_permission ADD CONSTRAINT up_member_scope_check CHECK (
					(organization_id IS NOT NULL AND member_id IS NOT NULL)
					OR
					(organization_id IS NULL AND member_id IS NULL)
				);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE UNIQUE INDEX IF NOT EXISTS user_permission_org_unique
				ON user_permission (member_id, registered_permission_id) WHERE member_id IS NOT NULL`,
			`CREATE UNIQUE INDEX IF NOT EXISTS user_permission_infra_unique
				ON user_permission (user_id, registered_permission_id) WHERE member_id IS NULL`,
			`CREATE INDEX IF NOT EXISTS user_permission_member_id_idx ON user_permission (member_id)`,
			`CREATE INDEX IF NOT EXISTS user_permission_user_id_idx   ON user_permission (user_id)`,

			`CREATE TABLE IF NOT EXISTS system_setting (
				key         TEXT PRIMARY KEY,
				value       TEXT NOT NULL,
				description TEXT,
				updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`
		]
	},

	// -------------------------------------------------------------------------
	// 11. Triggers
	// -------------------------------------------------------------------------
	{
		label: 'Creating database triggers',
		statements: [
			`CREATE OR REPLACE FUNCTION urm_member_scope_check() RETURNS trigger AS $$
			DECLARE
				role_scope perm_scope;
				member_user_id uuid;
			BEGIN
				SELECT scope INTO role_scope FROM public.permission_role WHERE id = NEW.role_id;
				IF role_scope = 'organization' AND NEW.member_id IS NULL THEN
					RAISE EXCEPTION 'member_id is required for org-scoped role memberships';
				END IF;
				IF role_scope = 'infrastructure' AND NEW.member_id IS NOT NULL THEN
					RAISE EXCEPTION 'member_id must be null for infrastructure role memberships';
				END IF;
				IF NEW.member_id IS NOT NULL THEN
					SELECT user_id INTO member_user_id FROM auth.member WHERE id = NEW.member_id;
					IF member_user_id != NEW.user_id THEN
						RAISE EXCEPTION 'member_id does not belong to user_id';
					END IF;
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql`,
			`DROP TRIGGER IF EXISTS urm_member_scope_check ON user_role_membership`,
			`CREATE TRIGGER urm_member_scope_check
				BEFORE INSERT OR UPDATE ON user_role_membership
				FOR EACH ROW EXECUTE FUNCTION urm_member_scope_check()`,

			`CREATE OR REPLACE FUNCTION up_member_user_check() RETURNS trigger AS $$
			DECLARE
				member_user_id uuid;
			BEGIN
				IF NEW.member_id IS NOT NULL THEN
					SELECT user_id INTO member_user_id FROM auth.member WHERE id = NEW.member_id;
					IF member_user_id != NEW.user_id THEN
						RAISE EXCEPTION 'member_id does not belong to user_id';
					END IF;
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql`,
			`DROP TRIGGER IF EXISTS up_member_user_check ON user_permission`,
			`CREATE TRIGGER up_member_user_check
				BEFORE INSERT OR UPDATE ON user_permission
				FOR EACH ROW EXECUTE FUNCTION up_member_user_check()`,

			`CREATE OR REPLACE FUNCTION permission_role_guard() RETURNS trigger AS $$
			DECLARE
				existing_default uuid;
			BEGIN
				IF TG_OP = 'DELETE' THEN
					IF OLD.is_default = true THEN
						RAISE EXCEPTION 'Cannot delete the Everyone role';
					END IF;
					RETURN OLD;
				END IF;
				IF TG_OP = 'UPDATE' AND OLD.is_default IS DISTINCT FROM NEW.is_default THEN
					RAISE EXCEPTION 'Cannot change is_default on a permission role';
				END IF;
				IF TG_OP = 'INSERT' AND NEW.is_default = true THEN
					SELECT id INTO existing_default
					FROM public.permission_role
					WHERE organization_id = NEW.organization_id AND is_default = true;
					IF existing_default IS NOT NULL THEN
						RAISE EXCEPTION 'An org can only have one default permission role (Everyone)';
					END IF;
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql`,
			`DROP TRIGGER IF EXISTS permission_role_guard ON permission_role`,
			`CREATE TRIGGER permission_role_guard
				BEFORE INSERT OR UPDATE OR DELETE ON permission_role
				FOR EACH ROW EXECUTE FUNCTION permission_role_guard()`,

			`CREATE OR REPLACE FUNCTION assign_default_permission_role() RETURNS trigger AS $$
			DECLARE
				default_role_id uuid;
			BEGIN
				SELECT id INTO default_role_id
				FROM public.permission_role
				WHERE organization_id = NEW.organization_id
				  AND is_default = true
				  AND scope = 'organization'
				LIMIT 1;
				IF default_role_id IS NOT NULL THEN
					INSERT INTO public.user_role_membership (user_id, member_id, role_id)
					VALUES (NEW.user_id, NEW.id, default_role_id)
					ON CONFLICT DO NOTHING;
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql`,
			`DROP TRIGGER IF EXISTS assign_default_permission_role ON auth.member`,
			`CREATE TRIGGER assign_default_permission_role
				AFTER INSERT ON auth.member
				FOR EACH ROW EXECUTE FUNCTION assign_default_permission_role()`
		]
	},

	// -------------------------------------------------------------------------
	// 12. Row-Level Security
	// -------------------------------------------------------------------------
	{
		label: 'Enabling row-level security',
		statements: [
			// Direct org_id tables
			...['survey', 'turf', 'plugin_installation', 'survey_question',
				'turf_location', 'turf_location_attempt', 'survey_question_response', 'turf_user'
			].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS org_isolation ON ${table}`,
				`CREATE POLICY org_isolation ON ${table}
					USING (organization_id = ${safe})
					WITH CHECK (organization_id = ${safe})`
			]),

			// location: two-tier — global rows always visible, org-private only to their org
			`ALTER TABLE location ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE location FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS location_visibility ON location`,
			`CREATE POLICY location_visibility ON location
				USING (organization_id IS NULL OR organization_id = ${safe})
				WITH CHECK (organization_id IS NULL OR organization_id = ${safe})`,

			// org_location
			`ALTER TABLE org_location ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE org_location FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON org_location`,
			`CREATE POLICY org_isolation ON org_location
				USING (organization_id = ${safe})
				WITH CHECK (organization_id = ${safe})`,

			// registered_permission: public read
			`ALTER TABLE registered_permission ENABLE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS public_read_permissions ON registered_permission`,
			`CREATE POLICY public_read_permissions ON registered_permission FOR SELECT USING (true)`,

			// permission_role: org rows visible to their org; infra rows visible to all
			`ALTER TABLE permission_role ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE permission_role FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON permission_role`,
			`CREATE POLICY org_isolation ON permission_role
				USING (organization_id IS NULL OR organization_id = ${safe})
				WITH CHECK (organization_id IS NULL OR organization_id = ${safe})`,

			// permission_role_entry: visible when its role is visible
			`ALTER TABLE permission_role_entry ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE permission_role_entry FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON permission_role_entry`,
			`CREATE POLICY org_isolation ON permission_role_entry
				USING (
					role_id IN (
						SELECT id FROM permission_role
						WHERE organization_id IS NULL OR organization_id = ${safe}
					)
				)`,

			// user_role_membership
			`ALTER TABLE user_role_membership ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE user_role_membership FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON user_role_membership`,
			`CREATE POLICY org_isolation ON user_role_membership
				USING (
					role_id IN (
						SELECT id FROM permission_role
						WHERE organization_id IS NULL OR organization_id = ${safe}
					)
				)`,

			// user_permission
			`ALTER TABLE user_permission ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE user_permission FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON user_permission`,
			`CREATE POLICY org_isolation ON user_permission
				USING (organization_id IS NULL OR organization_id = ${safe})
				WITH CHECK (organization_id IS NULL OR organization_id = ${safe})`
		]
	},

	// -------------------------------------------------------------------------
	// 13. Seed registered_permission catalog
	// -------------------------------------------------------------------------
	{
		label: 'Seeding permission catalog',
		statements: [
			`INSERT INTO registered_permission (key, name, description, scope) VALUES
				('system.access',    'Staff Dashboard Access',  'Grants access to the staff dashboard (/s/). Required to manage the organization.',                        'organization'),
				('canvass.use',      'Use Canvassing',          'Allows entering turf codes and using the canvassing app to collect responses in the field.',               'organization'),
				('turf.read',        'View Turfs',              'Grants access to the Turfs page to see the full list of canvassing areas and their assignments.',           'organization'),
				('turf.create',      'Cut New Turfs',           'Allows drawing and defining new turf boundaries using the map tool.',                                      'organization'),
				('turf.update',      'Edit Turfs',              'Allows renaming and modifying the boundaries of turfs that have already been created.',                    'organization'),
				('turf.delete',      'Delete Turfs',            'Allows permanently removing turfs from the organization.',                                                  'organization'),
				('survey.read',      'View Surveys',            'Grants access to the Surveys page to browse all survey templates.',                                         'organization'),
				('survey.create',    'Create Surveys',          'Allows building new survey templates for canvassers to use in the field.',                                  'organization'),
				('survey.update',    'Edit Surveys',            'Allows modifying the questions, answers, and settings of existing surveys.',                                'organization'),
				('survey.delete',    'Delete Surveys',          'Allows permanently removing surveys and all of their associated questions.',                                 'organization'),
				('response.read',    'View Responses',          'Grants access to the Responses page to see all data collected in the field.',                               'organization'),
				('response.delete',  'Delete Responses',        'Allows permanently removing individual canvassing responses from the organization.',                        'organization'),
				('member.read',      'View Members',            'Grants access to the Members page to see who belongs to the organization.',                                 'organization'),
				('member.invite',    'Invite Members',          'Allows sending invitations to new members to join the organization.',                                       'organization'),
				('member.update',    'Manage Member Roles',     'Allows changing the role assigned to any member within the organization.',                                  'organization'),
				('member.delete',    'Remove Members',          'Allows kicking members out of the organization entirely.',                                                  'organization'),
				('location.read',    'View Locations',          'Grants access to the Locations page to browse imported address data.',                                      'organization'),
				('location.create',  'Import Locations',        'Allows importing new address or location data into the organization.',                                      'organization'),
				('location.update',  'Edit Locations',          'Allows editing existing location records.',                                                                 'organization'),
				('location.delete',  'Delete Locations',        'Allows permanently removing location records from the organization.',                                       'organization'),
				('role.read',        'View Roles',              'Grants access to view roles and their permission assignments.',                                              'organization'),
				('role.create',      'Create Roles',            'Allows creating new permission roles for the organization.',                                                 'organization'),
				('role.update',      'Edit Roles',              'Allows modifying the name and permissions of existing roles.',                                               'organization'),
				('role.delete',      'Delete Roles',            'Allows permanently removing custom permission roles.',                                                       'organization'),
				('plugin.manage',    'Manage Plugins',          'Allows enabling and disabling plugins and changing their configuration for this organization.',              'organization'),
				('access',                   'Infrastructure Access',   'Grants access to the /infra infrastructure management panel.',                                      'infrastructure'),
				('locations.overture_sync',  'Trigger Overture Sync',  'Allows triggering an Overture Maps data sync to update the global location pool.',                  'infrastructure'),
				('users.manage',             'Manage Infra Users',      'Allows granting and revoking infrastructure permissions for other users.',                          'infrastructure'),
				('settings.manage',          'Manage System Settings',  'Allows viewing and editing system-wide settings.',                                                  'infrastructure')
			ON CONFLICT (scope, key) DO NOTHING`
		]
	},

	// -------------------------------------------------------------------------
	// 14. Seed system_setting
	// -------------------------------------------------------------------------
	{
		label: 'Seeding system settings',
		statements: [
			`INSERT INTO system_setting (key, value, description) VALUES
				('organizations.allow_creation', 'true', 'Whether users can create new organizations.')
			ON CONFLICT (key) DO NOTHING`
		]
	},

	// -------------------------------------------------------------------------
	// 15. location_unified view
	// -------------------------------------------------------------------------
	{
		label: 'Creating location_unified view',
		statements: [
			`CREATE OR REPLACE VIEW location_unified AS
				SELECT
					id,
					NULL::uuid AS organization_id,
					location_name, category, confidence,
					street, locality, postcode, region, country,
					latitude, longitude, geom,
					created_at, updated_at,
					'tier1'::text AS tier
				FROM location
			UNION ALL
				SELECT
					id,
					organization_id,
					location_name, category, confidence,
					street, locality, postcode, region, country,
					latitude, longitude, geom,
					created_at, updated_at,
					'tier2'::text AS tier
				FROM org_location`
		]
	}
];
