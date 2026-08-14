-- Up Migration
-- Mirrors SETUP_STEPS step 16: "Creating universe public version tables"
--
-- Version rows are append-only: an edit closes the current row by setting
-- valid_to and inserts a successor. valid_to IS NULL identifies the live row.

CREATE TABLE IF NOT EXISTS universe.public_person (
	id             UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	entity_id      UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS universe.public_organization (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	entity_id   UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS universe.public_location (
	id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	entity_id       UUID NOT NULL REFERENCES universe.public_entity(id) ON DELETE CASCADE,
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

DROP TABLE IF EXISTS universe.public_location CASCADE;
DROP TABLE IF EXISTS universe.public_organization CASCADE;
DROP TABLE IF EXISTS universe.public_person CASCADE;
