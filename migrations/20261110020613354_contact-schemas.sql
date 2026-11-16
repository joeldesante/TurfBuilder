-- Up Migration
-- A contact schema describes the shape of a contact's `metadata`: a flat set
-- of key/value pairs where the key is the metadata key and the value is the
-- data type expected. No nesting. Allowed types: text, boolean, number.
-- Example: {"name": "text", "is_open": "boolean", "employee_count": "number"}

CREATE FUNCTION universe.is_valid_contact_schema(definition jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT jsonb_typeof(definition) = 'object'
	  AND NOT EXISTS (
		SELECT 1
		FROM jsonb_each(definition) AS field(key, value)
		WHERE jsonb_typeof(field.value) IS DISTINCT FROM 'string'
		   OR (field.value #>> '{}') NOT IN ('text', 'boolean', 'number')
	  );
$$;

CREATE TABLE universe.contact_schema (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id uuid NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	schema_name text NOT NULL CHECK (btrim(schema_name) <> ''),
	schema jsonb NOT NULL DEFAULT '{}'::jsonb
		CONSTRAINT contact_schema_flat_typed CHECK (universe.is_valid_contact_schema(schema)),
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT contact_schema_org_name_unique UNIQUE (org_id, schema_name)
);

ALTER TABLE universe.contact_schema ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.contact_schema FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON universe.contact_schema
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE universe.contact_schema;

DROP FUNCTION universe.is_valid_contact_schema(jsonb);
