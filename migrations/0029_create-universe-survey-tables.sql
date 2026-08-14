-- Up Migration
-- Mirrors SETUP_STEPS step 29: "Creating universe survey tables"
--
-- Surveys belong to a bucket. Questions belong to a survey.

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
CREATE POLICY org_isolation ON universe.survey
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.survey_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.survey_question FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.survey_question;
CREATE POLICY org_isolation ON universe.survey_question
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE IF EXISTS universe.survey_question CASCADE;
DROP TABLE IF EXISTS universe.survey CASCADE;
