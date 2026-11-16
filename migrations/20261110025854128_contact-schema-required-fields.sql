-- Up Migration
-- Each field of a contact schema is required or optional. Required fields are
-- listed by name; the type of every field stays in `schema`, which keeps to its
-- flat name-to-type shape. The identifier field is always required, and the
-- database refuses a list that names a field the schema does not have.

CREATE FUNCTION universe.contact_schema_has_fields(definition jsonb, fields text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT NOT EXISTS (
		SELECT 1 FROM unnest(fields) AS field(name) WHERE NOT (definition ? field.name)
	);
$$;

ALTER TABLE universe.contact_schema
	ADD COLUMN required_fields text[] NOT NULL DEFAULT '{}';

-- A schema that already names an identifier keeps it required.
UPDATE universe.contact_schema
SET required_fields = ARRAY[identifier_field]
WHERE identifier_field IS NOT NULL;

ALTER TABLE universe.contact_schema
	ADD CONSTRAINT contact_schema_required_fields_exist
	CHECK (universe.contact_schema_has_fields(schema, required_fields)),
	ADD CONSTRAINT contact_schema_identifier_is_required
	CHECK (identifier_field IS NULL OR identifier_field = ANY (required_fields));

-- Down Migration

ALTER TABLE universe.contact_schema DROP COLUMN required_fields;

DROP FUNCTION universe.contact_schema_has_fields(jsonb, text[]);
