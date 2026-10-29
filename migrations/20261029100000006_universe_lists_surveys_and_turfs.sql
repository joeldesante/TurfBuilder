-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Creating universe bucket table

CREATE TABLE IF NOT EXISTS universe.bucket (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name       TEXT NOT NULL,
				slug       TEXT NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				filter     JSONB NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);

DO $$ BEGIN
				ALTER TABLE universe.bucket ADD CONSTRAINT bucket_org_slug_unique UNIQUE (org_id, slug);
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS bucket_org_id_idx ON universe.bucket (org_id);

ALTER TABLE universe.bucket ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.bucket FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.bucket;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.bucket
				USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating universe script table

CREATE TABLE IF NOT EXISTS universe.script (
				id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name       TEXT NOT NULL,
				contents   TEXT NOT NULL,
				org_id     UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				bucket     UUID NOT NULL REFERENCES universe.bucket(id) ON DELETE CASCADE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS script_org_id_idx ON universe.script (org_id);

CREATE INDEX IF NOT EXISTS script_bucket_idx  ON universe.script (bucket);

ALTER TABLE universe.script ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.script FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.script;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.script
				USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating universe list table

CREATE TABLE IF NOT EXISTS universe.list (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				name        TEXT NOT NULL,
				bucket      UUID NOT NULL REFERENCES universe.bucket(id) ON DELETE CASCADE,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				entity_type TEXT NOT NULL CHECK (entity_type IN ('people', 'locations')),
				expires_at  TIMESTAMPTZ NOT NULL,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS list_org_id_idx ON universe.list (org_id);

CREATE INDEX IF NOT EXISTS list_bucket_idx  ON universe.list (bucket);

ALTER TABLE universe.list ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.list FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.list;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.list
				USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating universe list_entry table

CREATE TABLE IF NOT EXISTS universe.list_entry (
				id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				list_id       UUID NOT NULL REFERENCES universe.list(id) ON DELETE CASCADE,
				record_id     UUID NOT NULL,
				record_source TEXT NOT NULL
					CHECK (record_source IN ('org_person', 'org_location'))
			);

CREATE INDEX IF NOT EXISTS list_entry_list_id_idx ON universe.list_entry (list_id);

-- Seeding universe catalogues

INSERT INTO universe.entity_type (slug, name, description) VALUES
				('person',       'Person',       'A human individual'),
				('organization', 'Organization', 'A business, non-profit, government body, or other group'),
				('location',     'Location',     'A physical place in the world'),
				('asset',        'Asset',        'A physical object such as a vehicle, device, or package')
			ON CONFLICT (slug) DO NOTHING;

INSERT INTO universe.organization_type (slug, name, description) VALUES
				('business',          'Business',          'A for-profit commercial entity'),
				('non-profit',        'Non-Profit',         'A not-for-profit organization'),
				('government',        'Government',         'A government body or agency'),
				('educational',       'Educational',        'A school, university, or educational institution'),
				('political',         'Political',          'A political party, campaign, or PAC'),
				('religious',         'Religious',          'A religious organization or institution'),
				('intergovernmental', 'Intergovernmental',  'An intergovernmental organization (e.g. UN, NATO)'),
				('sovereign-entity',  'Sovereign Entity',   'A sovereign state or territory')
			ON CONFLICT (slug) DO NOTHING;

INSERT INTO universe.relationship_type (slug, name, inverse_slug, inverse_name, description) VALUES
				('located_at',    'Located At',    'location_of',    'Location Of',    'An entity is physically located at a location'),
				('resident',      'Resident',      'residence_of',   'Residence Of',   'A person resides at a location'),
				('employed_by',   'Employed By',   'employs',        'Employs',        'A person is employed by an organization'),
				('owned_by',      'Owned By',      'owns',           'Owns',           'An entity is owned by another entity'),
				('member_of',     'Member Of',     'has_member',     'Has Member',     'A person is a member of an organization'),
				('subsidiary_of', 'Subsidiary Of', 'has_subsidiary', 'Has Subsidiary', 'An organization is a subsidiary of another'),
				('delivers_to',   'Delivers To',   'delivered_by',   'Delivered By',   'An entity delivers to a location or organization')
			ON CONFLICT (slug) DO NOTHING;

-- Creating universe survey tables

CREATE TABLE IF NOT EXISTS universe.survey (
				id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				bucket_id   UUID NOT NULL REFERENCES universe.bucket(id) ON DELETE CASCADE,
				name        TEXT NOT NULL,
				description TEXT,
				created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS survey_org_id_idx    ON universe.survey (org_id);

CREATE INDEX IF NOT EXISTS survey_bucket_id_idx ON universe.survey (bucket_id);

CREATE INDEX IF NOT EXISTS survey_fts_idx       ON universe.survey USING GIN (
				to_tsvector('simple', name || ' ' || COALESCE(description, ''))
			);

CREATE TABLE IF NOT EXISTS universe.survey_question (
				id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id        UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				survey_id     UUID NOT NULL REFERENCES universe.survey(id) ON DELETE CASCADE,
				question_text TEXT NOT NULL,
				question_type TEXT NOT NULL,
				order_index   INTEGER NOT NULL DEFAULT 0,
				choices       TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
				created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS survey_question_org_id_idx    ON universe.survey_question (org_id);

CREATE INDEX IF NOT EXISTS survey_question_survey_id_idx ON universe.survey_question (survey_id);

ALTER TABLE universe.survey ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.survey FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.survey;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.survey
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.survey_question ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.survey_question FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.survey_question;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.survey_question
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating universe turf and canvassing tables

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
				org_location_id    UUID NOT NULL REFERENCES universe.org_location(id) ON DELETE CASCADE,
				created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE UNIQUE INDEX IF NOT EXISTS turf_location_org_unique
				ON universe.turf_location (turf_id, org_location_id);

CREATE INDEX IF NOT EXISTS turf_location_org_id_idx          ON universe.turf_location (org_id);

CREATE INDEX IF NOT EXISTS turf_location_turf_id_idx         ON universe.turf_location (turf_id);

CREATE INDEX IF NOT EXISTS turf_location_org_location_idx    ON universe.turf_location (org_location_id);

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

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.turf
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.turf_location ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.turf_location FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.turf_location;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.turf_location
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.turf_location_attempt ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.turf_location_attempt FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.turf_location_attempt;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.turf_location_attempt
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.survey_question_response ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.survey_question_response FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.survey_question_response;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.survey_question_response
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

ALTER TABLE universe.turf_user ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.turf_user FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.turf_user;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.turf_user
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Down Migration
