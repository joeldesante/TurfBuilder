-- Up Migration
-- Mirrors SETUP_STEPS step 26: "Creating universe list table"
--
-- A list is a materialized snapshot of a bucket at a point in time. Turfs are
-- cut from a list, so the list must outlive the cut; expires_at bounds that.

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
CREATE POLICY org_isolation ON universe.list
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE IF EXISTS universe.list CASCADE;
