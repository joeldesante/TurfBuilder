-- Up Migration
-- Mirrors SETUP_STEPS step 14: "Creating universe catalogue tables"

CREATE TABLE IF NOT EXISTS universe.entity_type (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	slug        TEXT NOT NULL,
	name        TEXT NOT NULL,
	description TEXT,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.entity_type ADD CONSTRAINT entity_type_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS universe.organization_type (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	slug        TEXT NOT NULL,
	name        TEXT NOT NULL,
	description TEXT,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.organization_type ADD CONSTRAINT organization_type_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS universe.relationship_type (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	slug         TEXT NOT NULL,
	name         TEXT NOT NULL,
	inverse_slug TEXT NOT NULL,
	inverse_name TEXT NOT NULL,
	description  TEXT,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.relationship_type ADD CONSTRAINT relationship_type_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
	ALTER TABLE universe.relationship_type ADD CONSTRAINT relationship_type_inverse_slug_unique UNIQUE (inverse_slug);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Down Migration

DROP TABLE IF EXISTS universe.relationship_type CASCADE;
DROP TABLE IF EXISTS universe.organization_type CASCADE;
DROP TABLE IF EXISTS universe.entity_type CASCADE;
