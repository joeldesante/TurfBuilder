-- Up Migration
-- Mirrors SETUP_STEPS step 5: "Creating plugin and invite tables"

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

-- Down Migration

DROP TABLE IF EXISTS org_slug_invite CASCADE;
DROP TABLE IF EXISTS org_invite_link CASCADE;
DROP TABLE IF EXISTS plugin_installation CASCADE;
