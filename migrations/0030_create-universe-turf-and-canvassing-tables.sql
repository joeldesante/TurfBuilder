-- Up Migration
-- Mirrors SETUP_STEPS step 30: "Creating universe turf and canvassing tables"
--
-- Turfs are cut from a list (the list is the holder of its turfs) and reference
-- the bucket's surveys and scripts. Locations assigned to a turf point at
-- universe location records; attempts and survey responses hang off those
-- assignments.

CREATE TABLE IF NOT EXISTS universe.turf (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	list_id    UUID NOT NULL REFERENCES universe.list(id) ON DELETE CASCADE,
	code       TEXT NOT NULL,
	author_id  UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
	survey_id  UUID REFERENCES universe.survey(id) ON DELETE CASCADE,
	script_id  UUID REFERENCES universe.script(id) ON DELETE SET NULL,
	bounds     geometry,
	expires_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.turf ADD CONSTRAINT turf_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS turf_org_id_idx    ON universe.turf (org_id);
CREATE INDEX IF NOT EXISTS turf_list_id_idx   ON universe.turf (list_id);
CREATE INDEX IF NOT EXISTS turf_survey_id_idx ON universe.turf (survey_id) WHERE survey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS turf_script_id_idx ON universe.turf (script_id) WHERE script_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS universe.turf_location (
	id                 UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id             UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	turf_id            UUID NOT NULL REFERENCES universe.turf(id) ON DELETE CASCADE,
	public_location_id UUID REFERENCES universe.public_location(id) ON DELETE CASCADE,
	org_location_id    UUID REFERENCES universe.org_location(id) ON DELETE CASCADE,
	created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.turf_location ADD CONSTRAINT turf_location_source_check CHECK (
		(public_location_id IS NOT NULL AND org_location_id IS NULL) OR
		(public_location_id IS NULL AND org_location_id IS NOT NULL)
	);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS turf_location_public_unique
	ON universe.turf_location (turf_id, public_location_id) WHERE public_location_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS turf_location_org_unique
	ON universe.turf_location (turf_id, org_location_id) WHERE org_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS turf_location_org_id_idx          ON universe.turf_location (org_id);
CREATE INDEX IF NOT EXISTS turf_location_turf_id_idx         ON universe.turf_location (turf_id);
CREATE INDEX IF NOT EXISTS turf_location_public_location_idx ON universe.turf_location (public_location_id) WHERE public_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS turf_location_org_location_idx    ON universe.turf_location (org_location_id) WHERE org_location_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS universe.turf_location_attempt (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id           UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	turf_location_id UUID NOT NULL REFERENCES universe.turf_location(id) ON DELETE CASCADE,
	user_id          UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
	attempt_note     TEXT,
	contact_made     BOOLEAN,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.turf_location_attempt ADD CONSTRAINT turf_location_user_unique
		UNIQUE (turf_location_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS turf_location_attempt_org_id_idx           ON universe.turf_location_attempt (org_id);
CREATE INDEX IF NOT EXISTS turf_location_attempt_turf_location_id_idx ON universe.turf_location_attempt (turf_location_id);

CREATE TABLE IF NOT EXISTS universe.survey_question_response (
	id                       UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id                   UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	survey_question_id       UUID NOT NULL REFERENCES universe.survey_question(id) ON DELETE CASCADE,
	turf_location_attempt_id UUID NOT NULL REFERENCES universe.turf_location_attempt(id) ON DELETE CASCADE,
	response_value           TEXT,
	created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.survey_question_response ADD CONSTRAINT survey_question_response_unique
		UNIQUE (survey_question_id, turf_location_attempt_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS survey_question_response_org_id_idx  ON universe.survey_question_response (org_id);
CREATE INDEX IF NOT EXISTS survey_question_response_attempt_idx ON universe.survey_question_response (turf_location_attempt_id);

CREATE TABLE IF NOT EXISTS universe.turf_user (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	turf_id    UUID NOT NULL REFERENCES universe.turf(id) ON DELETE CASCADE,
	user_id    UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE universe.turf_user ADD CONSTRAINT turf_user_unique UNIQUE (turf_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS turf_user_org_id_idx  ON universe.turf_user (org_id);
CREATE INDEX IF NOT EXISTS turf_user_user_id_idx ON universe.turf_user (user_id);

ALTER TABLE universe.turf ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.turf FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.turf;
CREATE POLICY org_isolation ON universe.turf
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.turf_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.turf_location FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.turf_location;
CREATE POLICY org_isolation ON universe.turf_location
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.turf_location_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.turf_location_attempt FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.turf_location_attempt;
CREATE POLICY org_isolation ON universe.turf_location_attempt
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.survey_question_response ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.survey_question_response FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.survey_question_response;
CREATE POLICY org_isolation ON universe.survey_question_response
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.turf_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.turf_user FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.turf_user;
CREATE POLICY org_isolation ON universe.turf_user
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE IF EXISTS universe.turf_user CASCADE;
DROP TABLE IF EXISTS universe.survey_question_response CASCADE;
DROP TABLE IF EXISTS universe.turf_location_attempt CASCADE;
DROP TABLE IF EXISTS universe.turf_location CASCADE;
DROP TABLE IF EXISTS universe.turf CASCADE;
