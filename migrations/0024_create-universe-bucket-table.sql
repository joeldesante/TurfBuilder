-- Up Migration
-- Mirrors SETUP_STEPS step 24: "Creating universe bucket table"
--
-- A bucket is a saved filter over the universe. Lists, scripts, and surveys
-- all hang off one.

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
CREATE POLICY org_isolation ON universe.bucket
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE IF EXISTS universe.bucket CASCADE;
