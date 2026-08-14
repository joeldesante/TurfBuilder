-- Up Migration
-- Mirrors SETUP_STEPS step 25: "Creating universe script table"

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
CREATE POLICY org_isolation ON universe.script
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE IF EXISTS universe.script CASCADE;
