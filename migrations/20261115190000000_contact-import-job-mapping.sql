-- Up Migration
-- What a run of the contact import needs to know beyond the file: which contact
-- schema the contacts go into, and which CSV column fills each field. The browser
-- chooses both when Begin Import is pressed; the import function reads them from
-- the job. mapping is { field id or contact data id: column position from 0 }.

ALTER TABLE universe.contact_import_job
	ADD COLUMN schema_id uuid NOT NULL REFERENCES universe.contact_schema(id) ON DELETE CASCADE,
	ADD COLUMN mapping jsonb NOT NULL CHECK (jsonb_typeof(mapping) = 'object');

-- Down Migration

ALTER TABLE universe.contact_import_job
	DROP COLUMN mapping,
	DROP COLUMN schema_id;
