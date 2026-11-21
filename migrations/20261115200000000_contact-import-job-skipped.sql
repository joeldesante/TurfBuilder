-- Up Migration
-- Rows the import could not use: a missing or invalid coordinate, or a required
-- field left blank. They count as processed (the file has been read past them)
-- but no contact is made, so the page can say how many were left out.

ALTER TABLE universe.contact_import_job
	ADD COLUMN rows_skipped bigint NOT NULL DEFAULT 0 CHECK (rows_skipped >= 0);

-- Down Migration

ALTER TABLE universe.contact_import_job DROP COLUMN rows_skipped;
