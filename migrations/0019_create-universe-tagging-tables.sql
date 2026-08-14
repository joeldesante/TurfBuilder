-- Up Migration
-- Mirrors SETUP_STEPS step 19: "Creating universe tagging tables"
--
-- A tag is always org-owned, but can be applied to either a shared public
-- entity or an org-private one.

CREATE TABLE IF NOT EXISTS universe.tag (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	slug        TEXT NOT NULL,
	name        TEXT NOT NULL,
	description TEXT,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.tag ADD CONSTRAINT tag_slug_check
		CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
	ALTER TABLE universe.tag ADD CONSTRAINT tag_org_slug_unique UNIQUE (org_id, slug);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
	ALTER TABLE universe.tag ADD CONSTRAINT tag_org_name_unique UNIQUE (org_id, name);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS universe.entity_tag (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	tag_id           UUID NOT NULL REFERENCES universe.tag(id) ON DELETE CASCADE,
	org_id           UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	public_entity_id UUID REFERENCES universe.public_entity(id) ON DELETE CASCADE,
	org_entity_id    UUID REFERENCES universe.org_entity(id) ON DELETE CASCADE,
	tagged_by        UUID REFERENCES auth.user(id) ON DELETE SET NULL,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.entity_tag ADD CONSTRAINT entity_tag_entity_check CHECK (
		(public_entity_id IS NOT NULL AND org_entity_id IS NULL) OR
		(public_entity_id IS NULL AND org_entity_id IS NOT NULL)
	);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS entity_tag_public_unique
	ON universe.entity_tag (tag_id, public_entity_id) WHERE public_entity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS entity_tag_org_unique
	ON universe.entity_tag (tag_id, org_entity_id) WHERE org_entity_id IS NOT NULL;

-- Down Migration

DROP TABLE IF EXISTS universe.entity_tag CASCADE;
DROP TABLE IF EXISTS universe.tag CASCADE;
