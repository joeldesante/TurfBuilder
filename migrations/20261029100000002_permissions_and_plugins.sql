-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Creating plugin and invite tables

CREATE TABLE IF NOT EXISTS plugin_installation (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				plugin_slug     TEXT NOT NULL,
				enabled         BOOLEAN NOT NULL DEFAULT true,
				config          JSONB NOT NULL DEFAULT '{}',
				installed_by    UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at      TIMESTAMP NOT NULL DEFAULT now(),
				updated_at      TIMESTAMP NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE plugin_installation ADD CONSTRAINT plugin_installation_org_slug_unique
					UNIQUE (organization_id, plugin_slug);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS plugin_installation_org_id_idx ON plugin_installation (organization_id);

CREATE TABLE IF NOT EXISTS org_invite_link (
				id         TEXT PRIMARY KEY NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				created_by UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
				expires_at TIMESTAMP,
				created_at TIMESTAMP NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS org_invite_link_org_id_idx ON org_invite_link (org_id);

CREATE TABLE IF NOT EXISTS org_slug_invite (
				org_id  UUID PRIMARY KEY NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
				enabled BOOLEAN NOT NULL DEFAULT false
			);

-- Creating permission system tables

CREATE TABLE IF NOT EXISTS registered_permission (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				key         TEXT NOT NULL,
				name        TEXT NOT NULL,
				description TEXT NOT NULL,
				scope       perm_scope NOT NULL,
				created_at  TIMESTAMP NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE registered_permission ADD CONSTRAINT registered_permission_scope_key_unique
					UNIQUE (scope, key);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS permission_role (
				id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name            TEXT NOT NULL,
				weight          INTEGER NOT NULL DEFAULT 100,
				scope           perm_scope NOT NULL,
				organization_id UUID REFERENCES auth.organization(id) ON DELETE CASCADE,
				is_default      BOOLEAN NOT NULL DEFAULT false,
				created_at      TIMESTAMP NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE permission_role ADD CONSTRAINT permission_role_org_id_check
					CHECK (scope = 'infrastructure' OR organization_id IS NOT NULL);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS permission_role_org_weight_unique
				ON permission_role (organization_id, weight) WHERE scope = 'organization';

CREATE UNIQUE INDEX IF NOT EXISTS permission_role_infra_weight_unique
				ON permission_role (weight) WHERE scope = 'infrastructure';

CREATE INDEX IF NOT EXISTS perm_role_org_id_idx ON permission_role (organization_id);

CREATE TABLE IF NOT EXISTS permission_role_entry (
				id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				role_id                  UUID NOT NULL REFERENCES permission_role(id) ON DELETE CASCADE,
				registered_permission_id UUID NOT NULL REFERENCES registered_permission(id) ON DELETE CASCADE,
				value                    BOOLEAN NOT NULL DEFAULT true
			);

DO $$ BEGIN
				ALTER TABLE permission_role_entry ADD CONSTRAINT pre_role_perm_unique
					UNIQUE (role_id, registered_permission_id);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_role_membership (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id    UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				member_id  UUID REFERENCES auth.member(id) ON DELETE CASCADE,
				role_id    UUID NOT NULL REFERENCES permission_role(id) ON DELETE CASCADE,
				granted_by UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at TIMESTAMP NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE user_role_membership ADD CONSTRAINT urm_user_role_unique
					UNIQUE (user_id, role_id);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ugm_user_id_idx  ON user_role_membership (user_id);

CREATE INDEX IF NOT EXISTS ugm_member_id_idx ON user_role_membership (member_id);

CREATE INDEX IF NOT EXISTS urm_role_id_idx  ON user_role_membership (role_id);

CREATE TABLE IF NOT EXISTS user_permission (
				id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				user_id                  UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				member_id                UUID REFERENCES auth.member(id) ON DELETE CASCADE,
				registered_permission_id UUID NOT NULL REFERENCES registered_permission(id) ON DELETE CASCADE,
				organization_id          UUID REFERENCES auth.organization(id) ON DELETE CASCADE,
				value                    BOOLEAN NOT NULL DEFAULT true,
				granted_by               UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at               TIMESTAMP NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE user_permission ADD CONSTRAINT up_member_scope_check CHECK (
					(organization_id IS NOT NULL AND member_id IS NOT NULL)
					OR
					(organization_id IS NULL AND member_id IS NULL)
				);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_org_unique
				ON user_permission (member_id, registered_permission_id) WHERE member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_infra_unique
				ON user_permission (user_id, registered_permission_id) WHERE member_id IS NULL;

CREATE INDEX IF NOT EXISTS user_permission_member_id_idx ON user_permission (member_id);

CREATE INDEX IF NOT EXISTS user_permission_user_id_idx   ON user_permission (user_id);

CREATE TABLE IF NOT EXISTS system_setting (
				key         TEXT PRIMARY KEY,
				value       TEXT NOT NULL,
				description TEXT,
				updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE TABLE IF NOT EXISTS email_template (
				key         TEXT PRIMARY KEY,
				subject     TEXT NOT NULL,
				html_body   TEXT NOT NULL,
				variables   JSONB NOT NULL DEFAULT '[]',
				updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			);

-- Creating database triggers

CREATE OR REPLACE FUNCTION urm_member_scope_check() RETURNS trigger AS $$
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
			$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS urm_member_scope_check ON user_role_membership;

DO $mig$ BEGIN
CREATE TRIGGER urm_member_scope_check
				BEFORE INSERT OR UPDATE ON user_role_membership
				FOR EACH ROW EXECUTE FUNCTION urm_member_scope_check();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

CREATE OR REPLACE FUNCTION up_member_user_check() RETURNS trigger AS $$
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
			$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS up_member_user_check ON user_permission;

DO $mig$ BEGIN
CREATE TRIGGER up_member_user_check
				BEFORE INSERT OR UPDATE ON user_permission
				FOR EACH ROW EXECUTE FUNCTION up_member_user_check();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

CREATE OR REPLACE FUNCTION permission_role_guard() RETURNS trigger AS $$
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
			$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permission_role_guard ON permission_role;

DO $mig$ BEGIN
CREATE TRIGGER permission_role_guard
				BEFORE INSERT OR UPDATE OR DELETE ON permission_role
				FOR EACH ROW EXECUTE FUNCTION permission_role_guard();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

CREATE OR REPLACE FUNCTION assign_default_permission_role() RETURNS trigger AS $$
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
			$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_default_permission_role ON auth.member;

DO $mig$ BEGIN
CREATE TRIGGER assign_default_permission_role
				AFTER INSERT ON auth.member
				FOR EACH ROW EXECUTE FUNCTION assign_default_permission_role();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Enabling row-level security

ALTER TABLE plugin_installation ENABLE ROW LEVEL SECURITY;

ALTER TABLE plugin_installation FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON plugin_installation;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON plugin_installation
				USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE registered_permission ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_permissions ON registered_permission;

DO $mig$ BEGIN
CREATE POLICY public_read_permissions ON registered_permission FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE permission_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE permission_role FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON permission_role;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON permission_role
				USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE permission_role_entry ENABLE ROW LEVEL SECURITY;

ALTER TABLE permission_role_entry FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON permission_role_entry;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON permission_role_entry
				USING (
					role_id IN (
						SELECT id FROM permission_role
						WHERE organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
					)
				);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE user_role_membership ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_role_membership FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON user_role_membership;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON user_role_membership
				USING (
					role_id IN (
						SELECT id FROM permission_role
						WHERE organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
					)
				);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE user_permission ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_permission FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON user_permission;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON user_permission
				USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Down Migration
