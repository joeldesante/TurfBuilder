-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Creating addresses

INSERT INTO universe.entity_type (slug, name, description) VALUES
				('address', 'Address', 'A physical postal address, or a unit within one, with one point of coordinates')
			ON CONFLICT (slug) DO NOTHING;

INSERT INTO universe.relationship_type (slug, name, inverse_slug, inverse_name, description) VALUES
				('split_from', 'Split From', 'split_into', 'Split Into', 'An address was created by splitting another address')
			ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS universe.org_address (
				id                          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id                      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_id                   UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				premises_name               TEXT,
				premises_number             TEXT,
				thoroughfare_name           TEXT,
				thoroughfare_type           TEXT,
				thoroughfare_pre_qualifier  TEXT,
				thoroughfare_post_qualifier TEXT,
				dependent_locality          TEXT,
				locality                    TEXT,
				region                      TEXT,
				postcode                    TEXT,
				country_code                CHAR(2) NOT NULL,
				unit_type                   TEXT,
				unit_identifier             TEXT,
				floor                       TEXT,
				coordinates                 geometry(point, 4326) NOT NULL,
				valid_from                  TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to                    TIMESTAMPTZ,
				authored_by                 UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source                      TEXT NOT NULL,
				created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE universe.org_address ADD CONSTRAINT org_address_premises_check
					CHECK (premises_number IS NOT NULL OR premises_name IS NOT NULL);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_address;

DO $mig$ BEGIN
CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_address
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('address');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

DO $$ BEGIN
				ALTER TABLE universe.org_address ADD CONSTRAINT org_address_unit_check
					CHECK (unit_type IS NULL OR unit_identifier IS NOT NULL);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS org_address_org_id_idx         ON universe.org_address (org_id);

CREATE INDEX IF NOT EXISTS org_address_entity_id_idx      ON universe.org_address (entity_id);

CREATE INDEX IF NOT EXISTS org_address_entity_current_idx ON universe.org_address (entity_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS org_address_coordinates_idx    ON universe.org_address USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS org_address_geography_idx      ON universe.org_address USING GIST ((coordinates::geography));

CREATE INDEX IF NOT EXISTS org_address_postcode_idx       ON universe.org_address (org_id, postcode);

CREATE INDEX IF NOT EXISTS org_address_fts_idx            ON universe.org_address USING GIN (
				to_tsvector('simple',
					COALESCE(premises_name, '') || ' ' ||
					COALESCE(premises_number, '') || ' ' ||
					COALESCE(thoroughfare_name, '') || ' ' ||
					COALESCE(locality, '') || ' ' ||
					COALESCE(postcode, '')
				)
			);

ALTER TABLE universe.org_address ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_address FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_address;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_address
				USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating contacts

CREATE TABLE IF NOT EXISTS universe.org_contact (
				id                UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id            UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_id         UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				type              TEXT NOT NULL,
				address_entity_id UUID NOT NULL REFERENCES universe.org_entity(id),
				metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
				photo_keys        TEXT[] NOT NULL DEFAULT '{}',
				valid_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to          TIMESTAMPTZ,
				authored_by       UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source            TEXT NOT NULL,
				created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE universe.org_contact ADD CONSTRAINT org_contact_metadata_object
					CHECK (jsonb_typeof(metadata) = 'object');
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_contact;

DO $mig$ BEGIN
CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_contact
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('location');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

CREATE UNIQUE INDEX IF NOT EXISTS org_contact_entity_current_unique
				ON universe.org_contact (entity_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS org_contact_org_id_idx   ON universe.org_contact (org_id);

CREATE INDEX IF NOT EXISTS org_contact_entity_idx   ON universe.org_contact (entity_id);

CREATE INDEX IF NOT EXISTS org_contact_address_idx  ON universe.org_contact (address_entity_id);

CREATE INDEX IF NOT EXISTS org_contact_type_idx     ON universe.org_contact (org_id, type) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS org_contact_metadata_idx ON universe.org_contact USING GIN (metadata jsonb_path_ops);

ALTER TABLE universe.org_contact ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_contact FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_contact;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_contact
				USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating infrastructure dashboard tables

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS activity_event (
				id          BIGSERIAL PRIMARY KEY,
				occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				type        TEXT NOT NULL,
				user_id     UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				org_id      UUID REFERENCES auth.organization(id) ON DELETE SET NULL,
				metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
				source_key  TEXT
			);

CREATE UNIQUE INDEX IF NOT EXISTS activity_event_source_key_unique ON activity_event (source_key);

CREATE INDEX IF NOT EXISTS activity_event_occurred_idx      ON activity_event (occurred_at);

CREATE INDEX IF NOT EXISTS activity_event_type_occurred_idx ON activity_event (type, occurred_at);

CREATE INDEX IF NOT EXISTS activity_event_org_occurred_idx  ON activity_event (org_id, occurred_at);

CREATE INDEX IF NOT EXISTS activity_event_user_occurred_idx ON activity_event (user_id, occurred_at);

CREATE TABLE IF NOT EXISTS user_activity_day (
				day     DATE NOT NULL,
				user_id UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				org_key TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (day, user_id, org_key)
			);

CREATE INDEX IF NOT EXISTS user_activity_day_user_idx ON user_activity_day (user_id, day);

CREATE INDEX IF NOT EXISTS user_activity_day_org_idx  ON user_activity_day (org_key, day);

CREATE TABLE IF NOT EXISTS infra_audit_log (
				id          BIGSERIAL PRIMARY KEY,
				actor_id    UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				action      TEXT NOT NULL,
				target_type TEXT NOT NULL,
				target_id   TEXT,
				metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
				ip          TEXT,
				user_agent  TEXT,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS infra_audit_log_created_idx ON infra_audit_log (created_at);

CREATE INDEX IF NOT EXISTS infra_audit_log_target_idx  ON infra_audit_log (target_type, target_id, created_at);

CREATE INDEX IF NOT EXISTS infra_audit_log_actor_idx   ON infra_audit_log (actor_id, created_at);

CREATE TABLE IF NOT EXISTS email_log (
				id         BIGSERIAL PRIMARY KEY,
				recipient  TEXT NOT NULL,
				template   TEXT NOT NULL,
				subject    TEXT,
				status     TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
				error      TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS email_log_created_idx   ON email_log (created_at);

CREATE INDEX IF NOT EXISTS email_log_recipient_idx ON email_log (lower(recipient), created_at);

CREATE INDEX IF NOT EXISTS email_log_status_idx    ON email_log (status, created_at);

ALTER TABLE auth.organization ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;

ALTER TABLE auth.organization ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE auth.organization ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

ALTER TABLE auth.user ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE auth.session ADD COLUMN IF NOT EXISTS impersonated_by UUID
				REFERENCES auth.user(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_created_idx        ON auth.user (created_at);

CREATE INDEX IF NOT EXISTS session_user_idx        ON auth.session (user_id);

CREATE INDEX IF NOT EXISTS session_expires_idx     ON auth.session (expires_at);

CREATE INDEX IF NOT EXISTS member_org_idx          ON auth.member (organization_id);

CREATE INDEX IF NOT EXISTS member_user_idx         ON auth.member (user_id);

CREATE INDEX IF NOT EXISTS invitation_org_idx      ON auth.invitation (organization_id);

CREATE INDEX IF NOT EXISTS organization_created_idx ON auth.organization (created_at);

CREATE INDEX IF NOT EXISTS user_email_trgm_idx     ON auth.user USING GIN (lower(email) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS user_name_trgm_idx      ON auth.user USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS user_username_trgm_idx  ON auth.user USING GIN (lower(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS organization_name_trgm_idx ON auth.organization USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS organization_slug_trgm_idx ON auth.organization USING GIN (lower(slug) gin_trgm_ops);

INSERT INTO registered_permission (key, name, description, scope) VALUES
				('orgs.manage',       'Manage Organizations', 'Allows suspending, deleting, and transferring organizations, and removing their members.', 'infrastructure'),
				('users.impersonate', 'Impersonate Users',    'Allows signing in as another user to see what they see.',                                 'infrastructure'),
				('audit.read',        'View Audit Log',       'Allows viewing the log of changes infrastructure admins have made.',                        'infrastructure')
			ON CONFLICT (scope, key) DO NOTHING;

UPDATE registered_permission
				SET name = 'Manage Users', description = 'Allows managing user accounts and granting and revoking infrastructure roles.'
				WHERE scope = 'infrastructure' AND key = 'users.manage';

INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
				SELECT pr.id, rp.id, true
				FROM permission_role pr
				JOIN registered_permission rp ON rp.scope = 'infrastructure'
				WHERE pr.scope = 'infrastructure' AND pr.name = 'Infrastructure Administrator'
			ON CONFLICT DO NOTHING;

INSERT INTO system_setting (key, value, description) VALUES
				('links.analytics_url', 'https://analytics.turfbuilder.org', 'Web analytics dashboard (Umami), linked from the infrastructure panel. Empty hides the link.'),
				('links.tracing_url', '', 'Tracing UI (Jaeger), linked from the infrastructure panel. Empty hides the link.'),
				('links.custom', '[]', 'More links for the infrastructure panel, as a JSON list of {"label", "url"}.'),
				('activity.retention_days', '730', 'Days of activity history to keep. Older events are removed when migrations run. 0 keeps everything.')
			ON CONFLICT (key) DO NOTHING;

-- Down Migration
