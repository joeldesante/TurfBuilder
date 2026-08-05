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
		statements: [`CREATE EXTENSION IF NOT EXISTS postgis`]
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
	// 4. perm_scope enum
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
			)`,

			`CREATE TABLE IF NOT EXISTS email_template (
				key         TEXT PRIMARY KEY,
				subject     TEXT NOT NULL,
				html_body   TEXT NOT NULL,
				variables   JSONB NOT NULL DEFAULT '[]',
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
			`ALTER TABLE plugin_installation ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE plugin_installation FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON plugin_installation`,
			`CREATE POLICY org_isolation ON plugin_installation
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
				('organizations.allow_creation', 'true', 'Whether users can create new organizations.'),
				('html.header_content', '', 'Raw HTML injected into the <head> of every page (e.g. analytics tracking scripts).'),
				('errors.cat_gifs', 'true', 'Show a cat gif on error pages.'),
				('mail.transport', 'direct', 'The mail transport used to send outgoing emails (direct or ses).'),
				('mail.domain', '', 'The domain from which outgoing emails are sent (e.g. mail.example.com).'),
				('mail.ses.region', '', 'AWS region for SES (e.g. us-east-1).')
			ON CONFLICT (key) DO NOTHING`
		]
	},

	// -------------------------------------------------------------------------
	// 15. Seed email templates
	// -------------------------------------------------------------------------
	{
		label: 'Seeding email templates',
		statements: [
			`INSERT INTO email_template (key, subject, html_body, variables) VALUES
				(
					'auth.verify_email',
					'Verify your email address',
					'<p>Hi {{username}},</p><p>Click the link below to verify your email address:</p><p><a href="{{verification_url}}">Verify email</a></p><p>If you did not request this, you can ignore this email.</p>',
					'["username", "verification_url"]'
				),
				(
					'auth.reset_password',
					'Reset your password',
					'<p>Hi {{username}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_url}}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>',
					'["username", "reset_url"]'
				)
			ON CONFLICT (key) DO NOTHING`
		]
	},

	// -------------------------------------------------------------------------
	// 17. Universe schema
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe schema',
		statements: [`CREATE SCHEMA IF NOT EXISTS universe`]
	},

	// -------------------------------------------------------------------------
	// 18. Universe trigger functions
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe trigger functions',
		statements: [
			`CREATE OR REPLACE FUNCTION universe.set_entity_type() RETURNS trigger AS $$
			DECLARE
				expected_slug TEXT := TG_ARGV[0];
				type_record   RECORD;
				entity_table  TEXT;
				current_type  UUID;
			BEGIN
				-- Look up the entity type by slug
				SELECT id INTO type_record FROM universe.entity_type WHERE slug = expected_slug;
				IF NOT FOUND THEN
					RAISE EXCEPTION 'Unknown entity type slug: %', expected_slug;
				END IF;

				-- Determine which entity table to update based on the version table name
				IF TG_TABLE_NAME LIKE 'public_%' THEN
					entity_table := 'universe.public_entity';
				ELSE
					entity_table := 'universe.org_entity';
				END IF;

				-- Read the current type_id from the parent entity row
				EXECUTE format('SELECT type_id FROM %s WHERE id = $1', entity_table)
					INTO current_type USING NEW.entity_id;

				IF current_type IS NULL THEN
					-- First version insert — stamp the entity type
					EXECUTE format('UPDATE %s SET type_id = $1 WHERE id = $2', entity_table)
						USING type_record.id, NEW.entity_id;
				ELSIF current_type != type_record.id THEN
					-- Entity already typed as something different — reject
					RAISE EXCEPTION 'Entity % already has type_id %, cannot insert version of type %',
						NEW.entity_id, current_type, type_record.id;
				END IF;
				-- If current_type matches expected, do nothing

				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql`
		]
	},

	// -------------------------------------------------------------------------
	// 19. Universe catalogue tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe catalogue tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.entity_type (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				slug        TEXT NOT NULL,
				name        TEXT NOT NULL,
				description TEXT,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.entity_type ADD CONSTRAINT entity_type_slug_unique UNIQUE (slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS universe.organization_type (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				slug        TEXT NOT NULL,
				name        TEXT NOT NULL,
				description TEXT,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.organization_type ADD CONSTRAINT organization_type_slug_unique UNIQUE (slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS universe.relationship_type (
				id           UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				slug         TEXT NOT NULL,
				name         TEXT NOT NULL,
				inverse_slug TEXT NOT NULL,
				inverse_name TEXT NOT NULL,
				description  TEXT,
				created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.relationship_type ADD CONSTRAINT relationship_type_slug_unique UNIQUE (slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`DO $$ BEGIN
				ALTER TABLE universe.relationship_type ADD CONSTRAINT relationship_type_inverse_slug_unique UNIQUE (inverse_slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`
		]
	},

	// -------------------------------------------------------------------------
	// 20. Universe entity tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe entity tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.public_entity (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				type_id    UUID REFERENCES universe.entity_type(id) ON DELETE RESTRICT,
				source_ref TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS universe.org_entity (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				type_id    UUID REFERENCES universe.entity_type(id) ON DELETE RESTRICT,
				source_ref TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`
		]
	},

	// -------------------------------------------------------------------------
	// 21. Universe public version tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe public version tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.public_person (
				id             UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				entity_id      UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				first_name     TEXT,
				middle_name    TEXT,
				last_name      TEXT,
				suffix         TEXT,
				preferred_name TEXT,
				dob            DATE,
				phone          TEXT,
				email          TEXT,
				gender         TEXT,
				attributes     JSONB,
				valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to       TIMESTAMPTZ,
				authored_by    UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source         TEXT NOT NULL,
				created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS universe.public_organization (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				entity_id   UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				type_id     UUID REFERENCES universe.organization_type(id) ON DELETE RESTRICT,
				name        TEXT NOT NULL,
				phone       TEXT,
				email       TEXT,
				website     TEXT,
				attributes  JSONB,
				valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to    TIMESTAMPTZ,
				authored_by UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source      TEXT NOT NULL,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS universe.public_location (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				entity_id       UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				name            TEXT,
				address_line_1  TEXT,
				address_line_2  TEXT,
				address_line_3  TEXT,
				city            TEXT,
				state_or_region TEXT,
				postal_code     TEXT,
				country_code    TEXT,
				coordinates     geometry(point, 4326),
				valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to        TIMESTAMPTZ,
				authored_by     UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source          TEXT NOT NULL,
				created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
			)`
		]
	},

	// -------------------------------------------------------------------------
	// 22. Universe org version tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe org version tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.org_person (
				id             UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id         UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_id      UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				first_name     TEXT,
				middle_name    TEXT,
				last_name      TEXT,
				suffix         TEXT,
				preferred_name TEXT,
				dob            DATE,
				phone          TEXT,
				email          TEXT,
				gender         TEXT,
				attributes     JSONB,
				valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to       TIMESTAMPTZ,
				authored_by    UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source         TEXT NOT NULL,
				created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS universe.org_organization (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_id   UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				type_id     UUID REFERENCES universe.organization_type(id) ON DELETE RESTRICT,
				name        TEXT NOT NULL,
				phone       TEXT,
				email       TEXT,
				website     TEXT,
				attributes  JSONB,
				valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to    TIMESTAMPTZ,
				authored_by UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source      TEXT NOT NULL,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS universe.org_location (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id          UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_id       UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				name            TEXT,
				address_line_1  TEXT,
				address_line_2  TEXT,
				address_line_3  TEXT,
				city            TEXT,
				state_or_region TEXT,
				postal_code     TEXT,
				country_code    TEXT,
				coordinates     geometry(point, 4326),
				valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to        TIMESTAMPTZ,
				authored_by     UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source          TEXT NOT NULL,
				created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
			)`
		]
	},

	// -------------------------------------------------------------------------
	// 23. Universe relationship tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe relationship tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.public_relationship (
				id                   UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				from_entity_id       UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				to_entity_id         UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				relationship_type_id UUID NOT NULL REFERENCES universe.relationship_type(id) ON DELETE RESTRICT,
				valid_from           TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to             TIMESTAMPTZ,
				authored_by          UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source               TEXT NOT NULL,
				created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE TABLE IF NOT EXISTS universe.org_relationship (
				id                    UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id                UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				from_public_entity_id UUID REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				from_org_entity_id    UUID REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				to_public_entity_id   UUID REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				to_org_entity_id      UUID REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				relationship_type_id  UUID NOT NULL REFERENCES universe.relationship_type(id) ON DELETE RESTRICT,
				valid_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to              TIMESTAMPTZ,
				authored_by           UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source                TEXT NOT NULL,
				created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.org_relationship ADD CONSTRAINT org_relationship_from_check CHECK (
					(from_public_entity_id IS NOT NULL AND from_org_entity_id IS NULL) OR
					(from_public_entity_id IS NULL AND from_org_entity_id IS NOT NULL)
				);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`DO $$ BEGIN
				ALTER TABLE universe.org_relationship ADD CONSTRAINT org_relationship_to_check CHECK (
					(to_public_entity_id IS NOT NULL AND to_org_entity_id IS NULL) OR
					(to_public_entity_id IS NULL AND to_org_entity_id IS NOT NULL)
				);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`
		]
	},

	// -------------------------------------------------------------------------
	// 24. Universe tagging tables
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe tagging tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.tag (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				slug        TEXT NOT NULL,
				name        TEXT NOT NULL,
				description TEXT,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.tag ADD CONSTRAINT tag_slug_check
					CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`DO $$ BEGIN
				ALTER TABLE universe.tag ADD CONSTRAINT tag_org_slug_unique UNIQUE (org_id, slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`DO $$ BEGIN
				ALTER TABLE universe.tag ADD CONSTRAINT tag_org_name_unique UNIQUE (org_id, name);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE TABLE IF NOT EXISTS universe.entity_tag (
				id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				tag_id           UUID NOT NULL REFERENCES universe.tag(id) ON DELETE CASCADE,
				org_id           UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				public_entity_id UUID REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				org_entity_id    UUID REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				tagged_by        UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.entity_tag ADD CONSTRAINT entity_tag_entity_check CHECK (
					(public_entity_id IS NOT NULL AND org_entity_id IS NULL) OR
					(public_entity_id IS NULL AND org_entity_id IS NOT NULL)
				);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE UNIQUE INDEX IF NOT EXISTS entity_tag_public_unique
				ON universe.entity_tag (tag_id, public_entity_id) WHERE public_entity_id IS NOT NULL`,
			`CREATE UNIQUE INDEX IF NOT EXISTS entity_tag_org_unique
				ON universe.entity_tag (tag_id, org_entity_id) WHERE org_entity_id IS NOT NULL`
		]
	},

	// -------------------------------------------------------------------------
	// 25. Universe trigger bindings
	// -------------------------------------------------------------------------
	{
		label: 'Binding universe entity type triggers',
		statements: [
			`DROP TRIGGER IF EXISTS set_entity_type ON universe.public_person`,
			`CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.public_person
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('person')`,

			`DROP TRIGGER IF EXISTS set_entity_type ON universe.public_organization`,
			`CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.public_organization
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('organization')`,

			`DROP TRIGGER IF EXISTS set_entity_type ON universe.public_location`,
			`CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.public_location
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('location')`,

			`DROP TRIGGER IF EXISTS set_entity_type ON universe.org_person`,
			`CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_person
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('person')`,

			`DROP TRIGGER IF EXISTS set_entity_type ON universe.org_organization`,
			`CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_organization
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('organization')`,

			`DROP TRIGGER IF EXISTS set_entity_type ON universe.org_location`,
			`CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_location
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('location')`
		]
	},

	// -------------------------------------------------------------------------
	// 26. Universe RLS policies
	// -------------------------------------------------------------------------
	{
		label: 'Enabling universe row-level security',
		statements: [
			// Catalogue tables — public read, SELECT only
			...[
				'universe.entity_type',
				'universe.organization_type',
				'universe.relationship_type'
			].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS public_read ON ${table}`,
				`CREATE POLICY public_read ON ${table} FOR SELECT USING (true)`
			]),

			// Public entity + version tables — visible to all orgs
			...[
				'universe.public_entity',
				'universe.public_person',
				'universe.public_organization',
				'universe.public_location',
				'universe.public_relationship'
			].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS public_read ON ${table}`,
				`CREATE POLICY public_read ON ${table} FOR SELECT USING (true)`
			]),

			// Org-scoped tables — isolated to owning org
			...[
				'universe.org_entity',
				'universe.org_person',
				'universe.org_organization',
				'universe.org_location',
				'universe.org_relationship',
				'universe.tag',
				'universe.entity_tag'
			].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS org_isolation ON ${table}`,
				`CREATE POLICY org_isolation ON ${table}
					USING (org_id = ${safe})
					WITH CHECK (org_id = ${safe})`
			])
		]
	},

	// -------------------------------------------------------------------------
	// 26.5. Universe entity views
	//
	// These views combine public (shared across all orgs) and org-specific rows
	// into a single queryable surface. Org rows are scoped by
	// current_setting('app.current_org_id'), which withOrgTransaction sets on
	// every request. Because PostgreSQL views bypass underlying-table RLS by
	// default, the org filter is applied explicitly in the view WHERE clause
	// using the same `safe` expression as the RLS policies.
	//
	// v_locations is created in step 36 instead of here: it references
	// location_suggestion, which does not exist yet at this point. Defining it
	// in both places breaks reruns, because CREATE OR REPLACE VIEW cannot
	// narrow a view that step 36 has already widened.
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe entity views',
		statements: [
			`CREATE OR REPLACE VIEW universe.v_people AS
				SELECT
					pp.id,
					pp.first_name,
					pp.last_name,
					pp.email,
					pp.phone,
					pp.dob,
					'public_person' AS source
				FROM universe.public_person pp
				WHERE pp.valid_to IS NULL
				UNION ALL
				SELECT
					op.id,
					op.first_name,
					op.last_name,
					op.email,
					op.phone,
					op.dob,
					'org_person' AS source
				FROM universe.org_person op
				WHERE op.valid_to IS NULL
				  AND op.org_id = ${safe}`
		]
	},

	// -------------------------------------------------------------------------
	// 27. Universe indexes
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe indexes',
		statements: [
			// public_entity
			`CREATE INDEX IF NOT EXISTS public_entity_type_id_idx    ON universe.public_entity (type_id)`,
			`CREATE INDEX IF NOT EXISTS public_entity_source_ref_idx ON universe.public_entity (source_ref)`,

			// org_entity
			`CREATE INDEX IF NOT EXISTS org_entity_org_id_idx     ON universe.org_entity (org_id)`,
			`CREATE INDEX IF NOT EXISTS org_entity_type_id_idx    ON universe.org_entity (type_id)`,
			`CREATE INDEX IF NOT EXISTS org_entity_source_ref_idx ON universe.org_entity (source_ref)`,

			// public_person
			`CREATE INDEX IF NOT EXISTS public_person_entity_id_idx         ON universe.public_person (entity_id)`,
			`CREATE INDEX IF NOT EXISTS public_person_entity_current_idx     ON universe.public_person (entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS public_person_name_idx               ON universe.public_person (last_name, first_name)`,
			`CREATE INDEX IF NOT EXISTS public_person_fts_idx                ON universe.public_person USING GIN (
				to_tsvector('simple',
					COALESCE(first_name, '') || ' ' ||
					COALESCE(middle_name, '') || ' ' ||
					COALESCE(last_name, '') || ' ' ||
					COALESCE(preferred_name, '')
				)
			)`,

			// public_organization
			`CREATE INDEX IF NOT EXISTS public_organization_entity_id_idx     ON universe.public_organization (entity_id)`,
			`CREATE INDEX IF NOT EXISTS public_organization_entity_current_idx ON universe.public_organization (entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS public_organization_name_idx           ON universe.public_organization (name)`,
			`CREATE INDEX IF NOT EXISTS public_organization_fts_idx            ON universe.public_organization USING GIN (to_tsvector('simple', name))`,

			// public_location
			`CREATE INDEX IF NOT EXISTS public_location_entity_id_idx      ON universe.public_location (entity_id)`,
			`CREATE INDEX IF NOT EXISTS public_location_entity_current_idx  ON universe.public_location (entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS public_location_coordinates_idx     ON universe.public_location USING GIST (coordinates)`,
			`CREATE INDEX IF NOT EXISTS public_location_city_idx            ON universe.public_location (city)`,
			`CREATE INDEX IF NOT EXISTS public_location_postal_code_idx     ON universe.public_location (postal_code)`,
			`CREATE INDEX IF NOT EXISTS public_location_fts_idx             ON universe.public_location USING GIN (
				to_tsvector('simple',
					COALESCE(name, '') || ' ' ||
					COALESCE(address_line_1, '') || ' ' ||
					COALESCE(city, '') || ' ' ||
					COALESCE(postal_code, '')
				)
			)`,

			// org_person
			`CREATE INDEX IF NOT EXISTS org_person_org_id_idx          ON universe.org_person (org_id)`,
			`CREATE INDEX IF NOT EXISTS org_person_entity_id_idx        ON universe.org_person (entity_id)`,
			`CREATE INDEX IF NOT EXISTS org_person_entity_current_idx   ON universe.org_person (entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS org_person_name_idx             ON universe.org_person (org_id, last_name, first_name)`,
			`CREATE INDEX IF NOT EXISTS org_person_fts_idx              ON universe.org_person USING GIN (
				to_tsvector('simple',
					COALESCE(first_name, '') || ' ' ||
					COALESCE(middle_name, '') || ' ' ||
					COALESCE(last_name, '') || ' ' ||
					COALESCE(preferred_name, '')
				)
			)`,

			// org_organization
			`CREATE INDEX IF NOT EXISTS org_organization_org_id_idx          ON universe.org_organization (org_id)`,
			`CREATE INDEX IF NOT EXISTS org_organization_entity_id_idx        ON universe.org_organization (entity_id)`,
			`CREATE INDEX IF NOT EXISTS org_organization_entity_current_idx   ON universe.org_organization (entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS org_organization_name_idx             ON universe.org_organization (org_id, name)`,
			`CREATE INDEX IF NOT EXISTS org_organization_fts_idx              ON universe.org_organization USING GIN (to_tsvector('simple', name))`,

			// org_location
			`CREATE INDEX IF NOT EXISTS org_location_org_id_idx          ON universe.org_location (org_id)`,
			`CREATE INDEX IF NOT EXISTS org_location_entity_id_idx        ON universe.org_location (entity_id)`,
			`CREATE INDEX IF NOT EXISTS org_location_entity_current_idx   ON universe.org_location (entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS org_location_coordinates_idx      ON universe.org_location USING GIST (coordinates)`,
			`CREATE INDEX IF NOT EXISTS org_location_city_idx             ON universe.org_location (org_id, city)`,
			`CREATE INDEX IF NOT EXISTS org_location_postal_code_idx      ON universe.org_location (org_id, postal_code)`,
			`CREATE INDEX IF NOT EXISTS org_location_fts_idx              ON universe.org_location USING GIN (
				to_tsvector('simple',
					COALESCE(name, '') || ' ' ||
					COALESCE(address_line_1, '') || ' ' ||
					COALESCE(city, '') || ' ' ||
					COALESCE(postal_code, '')
				)
			)`,

			// public_relationship
			`CREATE INDEX IF NOT EXISTS public_rel_from_idx         ON universe.public_relationship (from_entity_id)`,
			`CREATE INDEX IF NOT EXISTS public_rel_to_idx           ON universe.public_relationship (to_entity_id)`,
			`CREATE INDEX IF NOT EXISTS public_rel_from_active_idx  ON universe.public_relationship (from_entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS public_rel_to_active_idx    ON universe.public_relationship (to_entity_id) WHERE valid_to IS NULL`,
			`CREATE INDEX IF NOT EXISTS public_rel_type_idx         ON universe.public_relationship (relationship_type_id)`,

			// org_relationship
			`CREATE INDEX IF NOT EXISTS org_rel_org_id_idx              ON universe.org_relationship (org_id)`,
			`CREATE INDEX IF NOT EXISTS org_rel_from_public_idx         ON universe.org_relationship (from_public_entity_id) WHERE from_public_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS org_rel_from_org_idx            ON universe.org_relationship (from_org_entity_id) WHERE from_org_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS org_rel_to_public_idx           ON universe.org_relationship (to_public_entity_id) WHERE to_public_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS org_rel_to_org_idx              ON universe.org_relationship (to_org_entity_id) WHERE to_org_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS org_rel_type_active_idx         ON universe.org_relationship (org_id, relationship_type_id) WHERE valid_to IS NULL`,

			// tag
			`CREATE INDEX IF NOT EXISTS tag_org_id_idx ON universe.tag (org_id)`,

			// entity_tag
			`CREATE INDEX IF NOT EXISTS entity_tag_org_id_idx        ON universe.entity_tag (org_id)`,
			`CREATE INDEX IF NOT EXISTS entity_tag_tag_id_idx         ON universe.entity_tag (tag_id)`,
			`CREATE INDEX IF NOT EXISTS entity_tag_public_entity_idx  ON universe.entity_tag (public_entity_id) WHERE public_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS entity_tag_org_entity_idx     ON universe.entity_tag (org_entity_id) WHERE org_entity_id IS NOT NULL`
		]
	},

	// -------------------------------------------------------------------------
	// 28. Universe bucket table
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe bucket table',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.bucket (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name       TEXT NOT NULL,
				slug       TEXT NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				filter     JSONB NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.bucket ADD CONSTRAINT bucket_org_slug_unique UNIQUE (org_id, slug);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS bucket_org_id_idx ON universe.bucket (org_id)`,

			`ALTER TABLE universe.bucket ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE universe.bucket FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON universe.bucket`,
			`CREATE POLICY org_isolation ON universe.bucket
				USING (org_id = ${safe})
				WITH CHECK (org_id = ${safe})`
		]
	},

	// -------------------------------------------------------------------------
	// 29. Universe script table
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe script table',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.script (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name       TEXT NOT NULL,
				contents   TEXT NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				bucket     UUID NOT NULL REFERENCES universe.bucket(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS script_org_id_idx ON universe.script (org_id)`,
			`CREATE INDEX IF NOT EXISTS script_bucket_idx  ON universe.script (bucket)`,

			`ALTER TABLE universe.script ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE universe.script FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON universe.script`,
			`CREATE POLICY org_isolation ON universe.script
				USING (org_id = ${safe})
				WITH CHECK (org_id = ${safe})`
		]
	},

	// -------------------------------------------------------------------------
	// 30. Universe list table
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe list table',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.list (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name        TEXT NOT NULL,
				bucket      UUID NOT NULL REFERENCES universe.bucket(id) ON DELETE CASCADE,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_type TEXT NOT NULL CHECK (entity_type IN ('people', 'locations')),
				expires_at  TIMESTAMPTZ NOT NULL,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS list_org_id_idx ON universe.list (org_id)`,
			`CREATE INDEX IF NOT EXISTS list_bucket_idx  ON universe.list (bucket)`,

			`ALTER TABLE universe.list ENABLE ROW LEVEL SECURITY`,
			`ALTER TABLE universe.list FORCE ROW LEVEL SECURITY`,
			`DROP POLICY IF EXISTS org_isolation ON universe.list`,
			`CREATE POLICY org_isolation ON universe.list
				USING (org_id = ${safe})
				WITH CHECK (org_id = ${safe})`
		]
	},

	// -------------------------------------------------------------------------
	// 31. Universe list_entry table
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe list_entry table',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.list_entry (
				id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				list_id       UUID NOT NULL REFERENCES universe.list(id) ON DELETE CASCADE,
				record_id     UUID NOT NULL,
				record_source TEXT NOT NULL
					CHECK (record_source IN ('public_person', 'org_person', 'public_location', 'org_location'))
			)`,
			`CREATE INDEX IF NOT EXISTS list_entry_list_id_idx ON universe.list_entry (list_id)`
		]
	},

	// -------------------------------------------------------------------------
	// 32. Universe seed data
	// -------------------------------------------------------------------------
	{
		label: 'Seeding universe catalogues',
		statements: [
			`INSERT INTO universe.entity_type (slug, name, description) VALUES
				('person',       'Person',       'A human individual'),
				('organization', 'Organization', 'A business, non-profit, government body, or other group'),
				('location',     'Location',     'A physical place in the world'),
				('asset',        'Asset',        'A physical object such as a vehicle, device, or package')
			ON CONFLICT (slug) DO NOTHING`,

			`INSERT INTO universe.organization_type (slug, name, description) VALUES
				('business',          'Business',          'A for-profit commercial entity'),
				('non-profit',        'Non-Profit',         'A not-for-profit organization'),
				('government',        'Government',         'A government body or agency'),
				('educational',       'Educational',        'A school, university, or educational institution'),
				('political',         'Political',          'A political party, campaign, or PAC'),
				('religious',         'Religious',          'A religious organization or institution'),
				('intergovernmental', 'Intergovernmental',  'An intergovernmental organization (e.g. UN, NATO)'),
				('sovereign-entity',  'Sovereign Entity',   'A sovereign state or territory')
			ON CONFLICT (slug) DO NOTHING`,

			`INSERT INTO universe.relationship_type (slug, name, inverse_slug, inverse_name, description) VALUES
				('located_at',    'Located At',    'location_of',    'Location Of',    'An entity is physically located at a location'),
				('resident',      'Resident',      'residence_of',   'Residence Of',   'A person resides at a location'),
				('employed_by',   'Employed By',   'employs',        'Employs',        'A person is employed by an organization'),
				('owned_by',      'Owned By',      'owns',           'Owns',           'An entity is owned by another entity'),
				('member_of',     'Member Of',     'has_member',     'Has Member',     'A person is a member of an organization'),
				('subsidiary_of', 'Subsidiary Of', 'has_subsidiary', 'Has Subsidiary', 'An organization is a subsidiary of another'),
				('delivers_to',   'Delivers To',   'delivered_by',   'Delivered By',   'An entity delivers to a location or organization')
			ON CONFLICT (slug) DO NOTHING`
		]
	},

	// -------------------------------------------------------------------------
	// 33. Universe survey tables
	//
	// Surveys belong to a bucket. Questions belong to a survey.
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe survey tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.survey (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				bucket_id   UUID NOT NULL REFERENCES universe.bucket(id) ON DELETE CASCADE,
				name        TEXT NOT NULL,
				description TEXT,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS survey_org_id_idx    ON universe.survey (org_id)`,
			`CREATE INDEX IF NOT EXISTS survey_bucket_id_idx ON universe.survey (bucket_id)`,
			`CREATE INDEX IF NOT EXISTS survey_fts_idx       ON universe.survey USING GIN (
				to_tsvector('simple', name || ' ' || COALESCE(description, ''))
			)`,

			`CREATE TABLE IF NOT EXISTS universe.survey_question (
				id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id        UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				survey_id     UUID NOT NULL REFERENCES universe.survey(id) ON DELETE CASCADE,
				question_text TEXT NOT NULL,
				question_type TEXT NOT NULL,
				order_index   INTEGER NOT NULL DEFAULT 0,
				choices       TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
				created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`CREATE INDEX IF NOT EXISTS survey_question_org_id_idx    ON universe.survey_question (org_id)`,
			`CREATE INDEX IF NOT EXISTS survey_question_survey_id_idx ON universe.survey_question (survey_id)`,

			...['universe.survey', 'universe.survey_question'].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS org_isolation ON ${table}`,
				`CREATE POLICY org_isolation ON ${table}
					USING (org_id = ${safe})
					WITH CHECK (org_id = ${safe})`
			])
		]
	},

	// -------------------------------------------------------------------------
	// 34. Universe turf and canvassing tables
	//
	// Turfs are cut from a list (the list is the holder of its turfs) and
	// reference the bucket's surveys and scripts. Locations assigned to a turf
	// point at universe location records; attempts and survey responses hang
	// off those assignments.
	// -------------------------------------------------------------------------
	{
		label: 'Creating universe turf and canvassing tables',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.turf (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				list_id    UUID NOT NULL REFERENCES universe.list(id) ON DELETE CASCADE,
				code       TEXT NOT NULL,
				author_id  UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				survey_id  UUID REFERENCES universe.survey(id) ON DELETE CASCADE,
				script_id  UUID REFERENCES universe.script(id) ON DELETE SET NULL,
				bounds     geometry,
				expires_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.turf ADD CONSTRAINT turf_code_unique UNIQUE (code);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS turf_org_id_idx    ON universe.turf (org_id)`,
			`CREATE INDEX IF NOT EXISTS turf_list_id_idx   ON universe.turf (list_id)`,
			`CREATE INDEX IF NOT EXISTS turf_survey_id_idx ON universe.turf (survey_id) WHERE survey_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS turf_script_id_idx ON universe.turf (script_id) WHERE script_id IS NOT NULL`,

			`CREATE TABLE IF NOT EXISTS universe.turf_location (
				id                 UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id             UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				turf_id            UUID NOT NULL REFERENCES universe.turf(id) ON DELETE CASCADE,
				public_location_id UUID REFERENCES universe.public_location(id) ON DELETE CASCADE,
				org_location_id    UUID REFERENCES universe.org_location(id) ON DELETE CASCADE,
				created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.turf_location ADD CONSTRAINT turf_location_source_check CHECK (
					(public_location_id IS NOT NULL AND org_location_id IS NULL) OR
					(public_location_id IS NULL AND org_location_id IS NOT NULL)
				);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE UNIQUE INDEX IF NOT EXISTS turf_location_public_unique
				ON universe.turf_location (turf_id, public_location_id) WHERE public_location_id IS NOT NULL`,
			`CREATE UNIQUE INDEX IF NOT EXISTS turf_location_org_unique
				ON universe.turf_location (turf_id, org_location_id) WHERE org_location_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS turf_location_org_id_idx          ON universe.turf_location (org_id)`,
			`CREATE INDEX IF NOT EXISTS turf_location_turf_id_idx         ON universe.turf_location (turf_id)`,
			`CREATE INDEX IF NOT EXISTS turf_location_public_location_idx ON universe.turf_location (public_location_id) WHERE public_location_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS turf_location_org_location_idx    ON universe.turf_location (org_location_id) WHERE org_location_id IS NOT NULL`,

			`CREATE TABLE IF NOT EXISTS universe.turf_location_attempt (
				id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id           UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				turf_location_id UUID NOT NULL REFERENCES universe.turf_location(id) ON DELETE CASCADE,
				user_id          UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				attempt_note     TEXT,
				contact_made     BOOLEAN,
				created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.turf_location_attempt ADD CONSTRAINT turf_location_user_unique
					UNIQUE (turf_location_id, user_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS turf_location_attempt_org_id_idx           ON universe.turf_location_attempt (org_id)`,
			`CREATE INDEX IF NOT EXISTS turf_location_attempt_turf_location_id_idx ON universe.turf_location_attempt (turf_location_id)`,

			`CREATE TABLE IF NOT EXISTS universe.survey_question_response (
				id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id                   UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				survey_question_id       UUID NOT NULL REFERENCES universe.survey_question(id) ON DELETE CASCADE,
				turf_location_attempt_id UUID NOT NULL REFERENCES universe.turf_location_attempt(id) ON DELETE CASCADE,
				response_value           TEXT,
				created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.survey_question_response ADD CONSTRAINT survey_question_response_unique
					UNIQUE (survey_question_id, turf_location_attempt_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS survey_question_response_org_id_idx  ON universe.survey_question_response (org_id)`,
			`CREATE INDEX IF NOT EXISTS survey_question_response_attempt_idx ON universe.survey_question_response (turf_location_attempt_id)`,

			`CREATE TABLE IF NOT EXISTS universe.turf_user (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				turf_id    UUID NOT NULL REFERENCES universe.turf(id) ON DELETE CASCADE,
				user_id    UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.turf_user ADD CONSTRAINT turf_user_unique UNIQUE (turf_id, user_id);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
			`CREATE INDEX IF NOT EXISTS turf_user_org_id_idx  ON universe.turf_user (org_id)`,
			`CREATE INDEX IF NOT EXISTS turf_user_user_id_idx ON universe.turf_user (user_id)`,

			...[
				'universe.turf',
				'universe.turf_location',
				'universe.turf_location_attempt',
				'universe.survey_question_response',
				'universe.turf_user'
			].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS org_isolation ON ${table}`,
				`CREATE POLICY org_isolation ON ${table}
					USING (org_id = ${safe})
					WITH CHECK (org_id = ${safe})`
			])
		]
	},

	// -------------------------------------------------------------------------
	// 35. Drop legacy public-schema tables
	//
	// These tables predate the universe schema and are fully superseded by
	// universe.survey, universe.turf, and the universe location tables. The
	// drops are idempotent so this step is safe to rerun.
	// -------------------------------------------------------------------------
	{
		label: 'Dropping legacy public schema tables',
		statements: [
			`DROP VIEW IF EXISTS location_unified`,
			`DROP TABLE IF EXISTS survey_question_response CASCADE`,
			`DROP TABLE IF EXISTS turf_location_attempt CASCADE`,
			`DROP TABLE IF EXISTS turf_user CASCADE`,
			`DROP TABLE IF EXISTS turf_location CASCADE`,
			`DROP TABLE IF EXISTS turf CASCADE`,
			`DROP TABLE IF EXISTS survey_question CASCADE`,
			`DROP TABLE IF EXISTS survey CASCADE`,
			`DROP TABLE IF EXISTS org_location CASCADE`,
			`DROP TABLE IF EXISTS location CASCADE`,
			`DROP FUNCTION IF EXISTS update_geometry() CASCADE`
		]
	},

	// -------------------------------------------------------------------------
	// 36. Location suggestions and photo storage
	//
	// Volunteers can suggest new locations from the field. A suggestion is
	// workflow state about an entity, not an attribute of it, so it lives in
	// its own table rather than forking a new org_location version on every
	// status change. Photo keys reference objects in the Spaces bucket.
	//
	// This step runs late because v_locations, defined here, references
	// location_suggestion, which in turn references universe.turf (step 34).
	// -------------------------------------------------------------------------
	{
		label: 'Creating location suggestions and photo storage',
		statements: [
			`ALTER TABLE universe.org_location
				ADD COLUMN IF NOT EXISTS photo_keys TEXT[] NOT NULL DEFAULT '{}'`,

			`CREATE TABLE IF NOT EXISTS universe.location_suggestion (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_id   UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				turf_id     UUID REFERENCES universe.turf(id) ON DELETE SET NULL,
				user_id     UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				status      TEXT NOT NULL DEFAULT 'tentative'
				              CHECK (status IN ('tentative', 'approved')),
				reviewed_by UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				reviewed_at TIMESTAMPTZ,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,

			`CREATE UNIQUE INDEX IF NOT EXISTS location_suggestion_entity_unique
				ON universe.location_suggestion (entity_id)`,
			`CREATE INDEX IF NOT EXISTS location_suggestion_org_id_idx
				ON universe.location_suggestion (org_id)`,
			`CREATE INDEX IF NOT EXISTS location_suggestion_turf_id_idx
				ON universe.location_suggestion (turf_id)`,
			`CREATE INDEX IF NOT EXISTS location_suggestion_user_id_idx
				ON universe.location_suggestion (user_id)`,
			`CREATE INDEX IF NOT EXISTS location_suggestion_pending_idx
				ON universe.location_suggestion (org_id, created_at DESC) WHERE status = 'tentative'`,

			// Required by createLocationVersion, which repoints list_entry rows
			// from a superseded org_location version to its successor.
			`CREATE INDEX IF NOT EXISTS list_entry_record_id_idx
				ON universe.list_entry (record_id)`,

			...['universe.location_suggestion'].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS org_isolation ON ${table}`,
				`CREATE POLICY org_isolation ON ${table}
					USING (org_id = ${safe})
					WITH CHECK (org_id = ${safe})`
			]),

			// The only definition of v_locations; step 26.5 deliberately leaves it
			// out. Dropped rather than replaced so a rerun against a database
			// carrying an older column shape converges instead of failing, since
			// CREATE OR REPLACE VIEW cannot change a view's columns. Nothing
			// depends on it as a database object.
			`DROP VIEW IF EXISTS universe.v_locations`,
			`CREATE VIEW universe.v_locations AS
				SELECT
					pl.id,
					pl.name,
					pl.address_line_1,
					pl.address_line_2,
					pl.address_line_3,
					pl.city,
					pl.state_or_region,
					pl.postal_code,
					pl.country_code,
					pl.coordinates,
					'public_location' AS source,
					pl.entity_id,
					ARRAY[]::text[] AS photo_keys
				FROM universe.public_location pl
				WHERE pl.valid_to IS NULL
				UNION ALL
				SELECT
					ol.id,
					ol.name,
					ol.address_line_1,
					ol.address_line_2,
					ol.address_line_3,
					ol.city,
					ol.state_or_region,
					ol.postal_code,
					ol.country_code,
					ol.coordinates,
					'org_location' AS source,
					ol.entity_id,
					ol.photo_keys
				FROM universe.org_location ol
				WHERE ol.valid_to IS NULL
				  AND ol.org_id = ${safe}
				  AND NOT EXISTS (
					SELECT 1 FROM universe.location_suggestion ls
					WHERE ls.entity_id = ol.entity_id
					  AND ls.status = 'tentative'
				  )`
		]
	},

	// -------------------------------------------------------------------------
	// 37. Location correction proposals
	//
	// A canvasser standing in front of a door can see when the record is wrong.
	// The correction cannot be written into the location itself, because that
	// would change the official dataset before anyone has checked it, so the
	// proposed values are parked here until an organizer approves them. On
	// approval they become a new version of the location; the photos are the
	// evidence the organizer reviews.
	//
	// The target is an entity rather than a version row so a proposal survives
	// the location being edited underneath it. Exactly one of the two entity
	// columns is set: public locations belong to the shared pool and cannot be
	// written, so approving a correction against one forks an org-private copy
	// instead.
	// -------------------------------------------------------------------------
	{
		label: 'Creating location correction proposals',
		statements: [
			`CREATE TABLE IF NOT EXISTS universe.location_edit_suggestion (
				id                UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id            UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				org_entity_id     UUID REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				public_entity_id  UUID REFERENCES universe.public_entity(id) ON DELETE CASCADE,
				turf_id           UUID REFERENCES universe.turf(id) ON DELETE SET NULL,
				turf_location_id  UUID REFERENCES universe.turf_location(id) ON DELETE SET NULL,
				user_id           UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				status            TEXT NOT NULL DEFAULT 'pending'
				                    CHECK (status IN ('pending', 'approved', 'rejected')),
				name              TEXT,
				address_line_1    TEXT,
				address_line_2    TEXT,
				address_line_3    TEXT,
				city              TEXT,
				state_or_region   TEXT,
				postal_code       TEXT,
				country_code      TEXT,
				coordinates       geometry(point, 4326),
				photo_keys        TEXT[] NOT NULL DEFAULT '{}',
				note              TEXT,
				reviewed_by       UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				reviewed_at       TIMESTAMPTZ,
				created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
			)`,
			`DO $$ BEGIN
				ALTER TABLE universe.location_edit_suggestion
					ADD CONSTRAINT location_edit_suggestion_target_check CHECK (
						(org_entity_id IS NOT NULL AND public_entity_id IS NULL) OR
						(org_entity_id IS NULL AND public_entity_id IS NOT NULL)
					);
			EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

			`CREATE INDEX IF NOT EXISTS location_edit_suggestion_org_id_idx
				ON universe.location_edit_suggestion (org_id)`,
			`CREATE INDEX IF NOT EXISTS location_edit_suggestion_org_entity_idx
				ON universe.location_edit_suggestion (org_entity_id) WHERE org_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS location_edit_suggestion_public_entity_idx
				ON universe.location_edit_suggestion (public_entity_id) WHERE public_entity_id IS NOT NULL`,
			`CREATE INDEX IF NOT EXISTS location_edit_suggestion_turf_location_idx
				ON universe.location_edit_suggestion (turf_location_id)`,
			`CREATE INDEX IF NOT EXISTS location_edit_suggestion_user_id_idx
				ON universe.location_edit_suggestion (user_id)`,
			`CREATE INDEX IF NOT EXISTS location_edit_suggestion_pending_idx
				ON universe.location_edit_suggestion (org_id, created_at DESC) WHERE status = 'pending'`,

			...['universe.location_edit_suggestion'].flatMap((table) => [
				`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
				`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
				`DROP POLICY IF EXISTS org_isolation ON ${table}`,
				`CREATE POLICY org_isolation ON ${table}
					USING (org_id = ${safe})
					WITH CHECK (org_id = ${safe})`
			])
		]
	}
];
