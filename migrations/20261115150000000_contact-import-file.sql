-- Up Migration
-- A CSV a staff member uploaded to import contacts from. The file itself is in
-- object storage under storage_key; this row is what the upload page lists.
-- Uploads go straight from the browser to storage, so a row starts as
-- 'uploading' and becomes 'ready' when the browser reports the upload is done.
-- A file is meant to be purged from storage at expires_at unless preserved.

CREATE TABLE universe.contact_import_file (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id uuid NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	storage_key text NOT NULL UNIQUE,
	file_name text NOT NULL CHECK (btrim(file_name) <> ''),
	size_bytes bigint NOT NULL CHECK (size_bytes > 0),
	-- Data rows, not counting the header. Null until the browser has counted them.
	row_count bigint CHECK (row_count >= 0),
	status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'ready')),
	uploaded_by uuid REFERENCES auth.user(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	-- Kept past expires_at until a person removes it.
	preserved boolean NOT NULL DEFAULT false,
	deleted_at timestamptz
);

CREATE INDEX contact_import_file_org_idx
	ON universe.contact_import_file (org_id, created_at DESC)
	WHERE deleted_at IS NULL;

-- For the job that purges expired files.
CREATE INDEX contact_import_file_expiry_idx
	ON universe.contact_import_file (expires_at)
	WHERE deleted_at IS NULL AND NOT preserved;

ALTER TABLE universe.contact_import_file ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.contact_import_file FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON universe.contact_import_file
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE universe.contact_import_file;
