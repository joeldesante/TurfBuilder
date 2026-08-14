-- Up Migration
-- Mirrors SETUP_STEPS step 27: "Creating universe list_entry table"
--
-- record_id is an untyped UUID rather than a foreign key because it may point
-- at any of four version tables; record_source names which one.
--
-- No RLS policy: reachable only through universe.list, which is org-isolated.

CREATE TABLE IF NOT EXISTS universe.list_entry (
	id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	list_id       UUID NOT NULL REFERENCES universe.list(id) ON DELETE CASCADE,
	record_id     UUID NOT NULL,
	record_source TEXT NOT NULL
		CHECK (record_source IN ('public_person', 'org_person', 'public_location', 'org_location'))
);

CREATE INDEX IF NOT EXISTS list_entry_list_id_idx ON universe.list_entry (list_id);

-- Down Migration

DROP TABLE IF EXISTS universe.list_entry CASCADE;
