-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Creating universe schema

CREATE SCHEMA IF NOT EXISTS universe;

-- Creating universe trigger functions

CREATE OR REPLACE FUNCTION universe.set_entity_type() RETURNS trigger AS $$
			DECLARE
				expected_slug TEXT := TG_ARGV[0];
				type_record   RECORD;
				current_type  UUID;
			BEGIN
				-- Look up the entity type by slug
				SELECT id INTO type_record FROM universe.entity_type WHERE slug = expected_slug;
				IF NOT FOUND THEN
					RAISE EXCEPTION 'Unknown entity type slug: %', expected_slug;
				END IF;

				-- Read the current type_id from the parent entity row
				SELECT type_id INTO current_type FROM universe.org_entity WHERE id = NEW.entity_id;

				IF current_type IS NULL THEN
					-- First version insert — stamp the entity type
					UPDATE universe.org_entity SET type_id = type_record.id WHERE id = NEW.entity_id;
				ELSIF current_type != type_record.id THEN
					-- Entity already typed as something different — reject
					RAISE EXCEPTION 'Entity % already has type_id %, cannot insert version of type %',
						NEW.entity_id, current_type, type_record.id;
				END IF;
				-- If current_type matches expected, do nothing

				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql;

-- Creating universe catalogue tables

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

-- Creating universe entity tables

CREATE TABLE IF NOT EXISTS universe.org_entity (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				type_id    UUID REFERENCES universe.entity_type(id) ON DELETE RESTRICT,
				source_ref TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);

-- Creating universe org version tables

CREATE TABLE IF NOT EXISTS universe.org_person (
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
			);

CREATE TABLE IF NOT EXISTS universe.org_organization (
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
			);

CREATE TABLE IF NOT EXISTS universe.org_location (
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
			);

-- Creating universe relationship tables

CREATE TABLE IF NOT EXISTS universe.org_relationship (
				id                    UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id                UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				from_org_entity_id    UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				to_org_entity_id      UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				relationship_type_id  UUID NOT NULL REFERENCES universe.relationship_type(id) ON DELETE RESTRICT,
				valid_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
				valid_to              TIMESTAMPTZ,
				authored_by           UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				source                TEXT NOT NULL,
				created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
			);

-- Creating universe tagging tables

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
				org_entity_id    UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				tagged_by        UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE UNIQUE INDEX IF NOT EXISTS entity_tag_org_unique
				ON universe.entity_tag (tag_id, org_entity_id);

-- Binding universe entity type triggers

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_person;

DO $mig$ BEGIN
CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_person
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('person');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_organization;

DO $mig$ BEGIN
CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_organization
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('organization');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_location;

DO $mig$ BEGIN
CREATE TRIGGER set_entity_type
				BEFORE INSERT ON universe.org_location
				FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('location');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Enabling universe row-level security

ALTER TABLE universe.entity_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.entity_type;

DO $mig$ BEGIN
CREATE POLICY public_read ON universe.entity_type FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.organization_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.organization_type;

DO $mig$ BEGIN
CREATE POLICY public_read ON universe.organization_type FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.relationship_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.relationship_type;

DO $mig$ BEGIN
CREATE POLICY public_read ON universe.relationship_type FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.org_entity ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_entity FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_entity;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_entity
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.org_person ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_person FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_person;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_person
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.org_organization ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_organization FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_organization;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_organization
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.org_location ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_location FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_location;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_location
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.org_relationship ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.org_relationship FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_relationship;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.org_relationship
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.tag ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.tag FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.tag;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.tag
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.entity_tag ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.entity_tag FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.entity_tag;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.entity_tag
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating universe entity views

CREATE OR REPLACE VIEW universe.v_people AS
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
				  AND op.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid;

-- Creating universe indexes

CREATE INDEX IF NOT EXISTS org_entity_org_id_idx     ON universe.org_entity (org_id);

CREATE INDEX IF NOT EXISTS org_entity_type_id_idx    ON universe.org_entity (type_id);

CREATE INDEX IF NOT EXISTS org_entity_source_ref_idx ON universe.org_entity (source_ref);

CREATE INDEX IF NOT EXISTS org_person_org_id_idx          ON universe.org_person (org_id);

CREATE INDEX IF NOT EXISTS org_person_entity_id_idx        ON universe.org_person (entity_id);

CREATE INDEX IF NOT EXISTS org_person_entity_current_idx   ON universe.org_person (entity_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS org_person_name_idx             ON universe.org_person (org_id, last_name, first_name);

CREATE INDEX IF NOT EXISTS org_person_fts_idx              ON universe.org_person USING GIN (
				to_tsvector('simple',
					COALESCE(first_name, '') || ' ' ||
					COALESCE(middle_name, '') || ' ' ||
					COALESCE(last_name, '') || ' ' ||
					COALESCE(preferred_name, '')
				)
			);

CREATE INDEX IF NOT EXISTS org_organization_org_id_idx          ON universe.org_organization (org_id);

CREATE INDEX IF NOT EXISTS org_organization_entity_id_idx        ON universe.org_organization (entity_id);

CREATE INDEX IF NOT EXISTS org_organization_entity_current_idx   ON universe.org_organization (entity_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS org_organization_name_idx             ON universe.org_organization (org_id, name);

CREATE INDEX IF NOT EXISTS org_organization_fts_idx              ON universe.org_organization USING GIN (to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS org_location_org_id_idx          ON universe.org_location (org_id);

CREATE INDEX IF NOT EXISTS org_location_entity_id_idx        ON universe.org_location (entity_id);

CREATE INDEX IF NOT EXISTS org_location_entity_current_idx   ON universe.org_location (entity_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS org_location_coordinates_idx      ON universe.org_location USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS org_location_geography_idx        ON universe.org_location USING GIST ((coordinates::geography));

CREATE INDEX IF NOT EXISTS org_location_city_idx             ON universe.org_location (org_id, city);

CREATE INDEX IF NOT EXISTS org_location_postal_code_idx      ON universe.org_location (org_id, postal_code);

CREATE INDEX IF NOT EXISTS org_location_fts_idx              ON universe.org_location USING GIN (
				to_tsvector('simple',
					COALESCE(name, '') || ' ' ||
					COALESCE(address_line_1, '') || ' ' ||
					COALESCE(city, '') || ' ' ||
					COALESCE(postal_code, '')
				)
			);

CREATE INDEX IF NOT EXISTS org_rel_org_id_idx              ON universe.org_relationship (org_id);

CREATE INDEX IF NOT EXISTS org_rel_from_org_idx            ON universe.org_relationship (from_org_entity_id);

CREATE INDEX IF NOT EXISTS org_rel_to_org_idx              ON universe.org_relationship (to_org_entity_id);

CREATE INDEX IF NOT EXISTS org_rel_type_active_idx         ON universe.org_relationship (org_id, relationship_type_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS tag_org_id_idx ON universe.tag (org_id);

CREATE INDEX IF NOT EXISTS entity_tag_org_id_idx        ON universe.entity_tag (org_id);

CREATE INDEX IF NOT EXISTS entity_tag_tag_id_idx         ON universe.entity_tag (tag_id);

CREATE INDEX IF NOT EXISTS entity_tag_org_entity_idx     ON universe.entity_tag (org_entity_id);

-- Down Migration
