-- Up Migration
-- One run of the contact import for an uploaded CSV. The import function updates
-- rows_processed after every batch it commits, so the browser can poll this row
-- for progress without talking to the function. rows_processed counts rows
-- already written, so a run that dies partway can be started again from there.

CREATE TABLE universe.contact_import_job (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id uuid NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	file_id uuid NOT NULL REFERENCES universe.contact_import_file(id) ON DELETE CASCADE,
	status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
	-- Copied from the file when the job starts, so progress has something to divide by.
	rows_total bigint CHECK (rows_total >= 0),
	rows_processed bigint NOT NULL DEFAULT 0 CHECK (rows_processed >= 0),
	-- A message safe to show a user. Never row values.
	error text,
	created_by uuid REFERENCES auth.user(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	started_at timestamptz,
	-- Moves on every batch, so a 'running' job that has stopped moving is visible.
	updated_at timestamptz NOT NULL DEFAULT now(),
	finished_at timestamptz
);

CREATE INDEX contact_import_job_file_idx
	ON universe.contact_import_job (file_id, created_at DESC);

CREATE INDEX contact_import_job_org_idx
	ON universe.contact_import_job (org_id, created_at DESC);

ALTER TABLE universe.contact_import_job ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.contact_import_job FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON universe.contact_import_job
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE universe.contact_import_job;
