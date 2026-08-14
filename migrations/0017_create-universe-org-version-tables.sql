-- Up Migration
-- Mirrors SETUP_STEPS step 17: "Creating universe org version tables"
--
-- Same version shape as the public tables, plus org_id so RLS can isolate them.

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

-- Down Migration

DROP TABLE IF EXISTS universe.org_location CASCADE;
DROP TABLE IF EXISTS universe.org_organization CASCADE;
DROP TABLE IF EXISTS universe.org_person CASCADE;
