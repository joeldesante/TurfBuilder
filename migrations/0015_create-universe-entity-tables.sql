-- Up Migration
-- Mirrors SETUP_STEPS step 15: "Creating universe entity tables"
--
-- type_id is nullable because universe.set_entity_type stamps it from the
-- first version row inserted, not at entity creation time.

CREATE TABLE IF NOT EXISTS universe.public_entity (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	type_id    UUID REFERENCES universe.entity_type(id) ON DELETE RESTRICT,
	source_ref TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS universe.org_entity (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	type_id    UUID REFERENCES universe.entity_type(id) ON DELETE RESTRICT,
	source_ref TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS universe.org_entity CASCADE;
DROP TABLE IF EXISTS universe.public_entity CASCADE;
