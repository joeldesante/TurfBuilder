-- Up Migration
-- A schema can name one of its text fields as the identifier: the value that
-- labels a contact in lists and on the map. Left empty, a contact is labelled
-- by its full address, and by its coordinates when it has no address text.
-- The database refuses a field that is not in the schema or is not text.

ALTER TABLE universe.contact_schema ADD COLUMN identifier_field text;

ALTER TABLE universe.contact_schema
	ADD CONSTRAINT contact_schema_identifier_is_text
	CHECK (identifier_field IS NULL OR schema ->> identifier_field = 'text');

-- Down Migration

ALTER TABLE universe.contact_schema DROP COLUMN identifier_field;
