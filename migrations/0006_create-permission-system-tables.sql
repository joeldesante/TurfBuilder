-- Up Migration
-- Mirrors SETUP_STEPS step 6: "Creating permission system tables"

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

-- Down Migration

DROP TABLE IF EXISTS email_template CASCADE;
DROP TABLE IF EXISTS system_setting CASCADE;
DROP TABLE IF EXISTS user_permission CASCADE;
DROP TABLE IF EXISTS user_role_membership CASCADE;
DROP TABLE IF EXISTS permission_role_entry CASCADE;
DROP TABLE IF EXISTS permission_role CASCADE;
DROP TABLE IF EXISTS registered_permission CASCADE;
