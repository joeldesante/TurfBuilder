-- Up Migration
-- Mirrors SETUP_STEPS step 18: "Creating universe relationship tables"
--
-- An org relationship can point at either a public entity or an org entity on
-- each end, so each end is a pair of nullable columns with a CHECK enforcing
-- exactly one.

CREATE TABLE IF NOT EXISTS universe.public_relationship (
	id                   UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	from_entity_id       UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
	to_entity_id         UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
	relationship_type_id UUID NOT NULL REFERENCES universe.relationship_type(id) ON DELETE RESTRICT,
	valid_from           TIMESTAMPTZ NOT NULL DEFAULT now(),
	valid_to             TIMESTAMPTZ,
	authored_by          UUID REFERENCES auth.user(id) ON DELETE SET NULL,
	source               TEXT NOT NULL,
	created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS universe.org_relationship (
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
);

DO $$ BEGIN
	ALTER TABLE universe.org_relationship ADD CONSTRAINT org_relationship_from_check CHECK (
		(from_public_entity_id IS NOT NULL AND from_org_entity_id IS NULL) OR
		(from_public_entity_id IS NULL AND from_org_entity_id IS NOT NULL)
	);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
	ALTER TABLE universe.org_relationship ADD CONSTRAINT org_relationship_to_check CHECK (
		(to_public_entity_id IS NOT NULL AND to_org_entity_id IS NULL) OR
		(to_public_entity_id IS NULL AND to_org_entity_id IS NOT NULL)
	);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Down Migration

DROP TABLE IF EXISTS universe.org_relationship CASCADE;
DROP TABLE IF EXISTS universe.public_relationship CASCADE;
