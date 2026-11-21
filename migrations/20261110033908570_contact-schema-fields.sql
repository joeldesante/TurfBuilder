-- Up Migration
-- A contact schema's fields become rows, each with its own id. Contacts store
-- their values under the field's id (`metadata = {"<field-id>": value}`), and
-- filters, the identifier, and the required flag all point at that id, so
-- renaming a field changes one row and touches no contact. Names are unique
-- within a schema, whatever their capital letters.
--
-- No contact names a schema yet, so there is no contact data to rekey. The
-- schemas that exist are converted below.

CREATE TABLE universe.contact_schema_field (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id uuid NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	schema_id uuid NOT NULL REFERENCES universe.contact_schema(id) ON DELETE CASCADE,
	name text NOT NULL CHECK (btrim(name) <> '' AND name = btrim(name) AND char_length(name) <= 100),
	type text NOT NULL CHECK (type IN ('text', 'boolean', 'number')),
	required boolean NOT NULL DEFAULT false,
	position integer NOT NULL CHECK (position >= 0),
	created_at timestamptz NOT NULL DEFAULT now(),
	-- Lets contact_schema point at one of its own fields.
	CONSTRAINT contact_schema_field_id_schema_unique UNIQUE (id, schema_id)
);

CREATE UNIQUE INDEX contact_schema_field_name_unique
	ON universe.contact_schema_field (schema_id, lower(name));

CREATE INDEX contact_schema_field_org_idx ON universe.contact_schema_field (org_id);

ALTER TABLE universe.contact_schema_field ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.contact_schema_field FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON universe.contact_schema_field
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Convert the schemas that exist: one row per entry of the old flat map.
INSERT INTO universe.contact_schema_field (org_id, schema_id, name, type, required, position)
SELECT cs.org_id,
       cs.id,
       entry.key,
       entry.value,
       entry.key = ANY (cs.required_fields),
       (row_number() OVER (PARTITION BY cs.id ORDER BY entry.key) - 1)::integer
FROM universe.contact_schema cs
CROSS JOIN LATERAL jsonb_each_text(cs.schema) AS entry(key, value);

ALTER TABLE universe.contact_schema ADD COLUMN identifier_field_id uuid;

UPDATE universe.contact_schema cs
SET identifier_field_id = f.id
FROM universe.contact_schema_field f
WHERE f.schema_id = cs.id AND cs.identifier_field IS NOT NULL AND f.name = cs.identifier_field;

-- The identifier is one of the schema's own fields.
ALTER TABLE universe.contact_schema
	ADD CONSTRAINT contact_schema_identifier_in_schema
	FOREIGN KEY (identifier_field_id, id)
	REFERENCES universe.contact_schema_field (id, schema_id);

-- The identifier must be a required text field. Checked at the end of the
-- transaction, so a schema and its fields can be written in any order, and
-- again whenever a field changes.
CREATE FUNCTION universe.assert_contact_schema_identifier(target uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM universe.contact_schema cs
		JOIN universe.contact_schema_field f ON f.id = cs.identifier_field_id
		WHERE cs.id = target AND (f.type <> 'text' OR NOT f.required)
	) THEN
		RAISE EXCEPTION 'The identifier must be a required text field.'
			USING ERRCODE = 'check_violation';
	END IF;
END;
$$;

CREATE FUNCTION universe.check_contact_schema_identifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM universe.assert_contact_schema_identifier(NEW.id);
	RETURN NULL;
END;
$$;

CREATE FUNCTION universe.check_contact_schema_field_identifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM universe.assert_contact_schema_identifier(OLD.schema_id);
	END IF;
	IF TG_OP <> 'DELETE' THEN
		PERFORM universe.assert_contact_schema_identifier(NEW.schema_id);
	END IF;
	RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER contact_schema_identifier_check
	AFTER INSERT OR UPDATE OF identifier_field_id ON universe.contact_schema
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION universe.check_contact_schema_identifier();

CREATE CONSTRAINT TRIGGER contact_schema_field_identifier_check
	AFTER INSERT OR UPDATE OR DELETE ON universe.contact_schema_field
	DEFERRABLE INITIALLY DEFERRED
	FOR EACH ROW EXECUTE FUNCTION universe.check_contact_schema_field_identifier();

-- The flat map and the name-based settings are replaced by the field rows.
ALTER TABLE universe.contact_schema
	DROP CONSTRAINT contact_schema_flat_typed,
	DROP CONSTRAINT contact_schema_identifier_is_required,
	DROP CONSTRAINT contact_schema_identifier_is_text,
	DROP CONSTRAINT contact_schema_required_fields_exist,
	DROP COLUMN schema,
	DROP COLUMN identifier_field,
	DROP COLUMN required_fields;

DROP FUNCTION universe.is_valid_contact_schema(jsonb);

DROP FUNCTION universe.contact_schema_has_fields(jsonb, text[]);

-- Down Migration
-- Rebuilds the flat map, keyed by name. Contact values stay keyed by field id.

ALTER TABLE universe.contact_schema
	ADD COLUMN schema jsonb NOT NULL DEFAULT '{}'::jsonb,
	ADD COLUMN identifier_field text,
	ADD COLUMN required_fields text[] NOT NULL DEFAULT '{}';

UPDATE universe.contact_schema cs
SET schema = COALESCE(
		(SELECT jsonb_object_agg(f.name, f.type) FROM universe.contact_schema_field f WHERE f.schema_id = cs.id),
		'{}'::jsonb
	),
	required_fields = COALESCE(
		(SELECT array_agg(f.name) FROM universe.contact_schema_field f WHERE f.schema_id = cs.id AND f.required),
		'{}'
	),
	identifier_field = (SELECT f.name FROM universe.contact_schema_field f WHERE f.id = cs.identifier_field_id);

DROP TRIGGER contact_schema_identifier_check ON universe.contact_schema;
DROP TRIGGER contact_schema_field_identifier_check ON universe.contact_schema_field;
DROP FUNCTION universe.check_contact_schema_identifier();
DROP FUNCTION universe.check_contact_schema_field_identifier();
DROP FUNCTION universe.assert_contact_schema_identifier(uuid);

ALTER TABLE universe.contact_schema
	DROP CONSTRAINT contact_schema_identifier_in_schema,
	DROP COLUMN identifier_field_id;

DROP TABLE universe.contact_schema_field;

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
	ADD CONSTRAINT contact_schema_flat_typed CHECK (universe.is_valid_contact_schema(schema)),
	ADD CONSTRAINT contact_schema_identifier_is_text
		CHECK (identifier_field IS NULL OR schema ->> identifier_field = 'text'),
	ADD CONSTRAINT contact_schema_required_fields_exist
		CHECK (universe.contact_schema_has_fields(schema, required_fields)),
	ADD CONSTRAINT contact_schema_identifier_is_required
		CHECK (identifier_field IS NULL OR identifier_field = ANY (required_fields));
