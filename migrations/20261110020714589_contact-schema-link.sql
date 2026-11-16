-- Up Migration
-- A contact can name the schema that describes its metadata. The link is what
-- "in use" means for a contact schema: while any version of any contact names
-- it, the schema cannot be deleted. RESTRICT makes the database refuse the
-- delete even if a caller skips the check in the service.

ALTER TABLE universe.org_contact
	ADD COLUMN schema_id uuid REFERENCES universe.contact_schema(id) ON DELETE RESTRICT;

CREATE INDEX org_contact_schema_idx ON universe.org_contact (schema_id) WHERE schema_id IS NOT NULL;

-- Down Migration

DROP INDEX universe.org_contact_schema_idx;

ALTER TABLE universe.org_contact DROP COLUMN schema_id;
