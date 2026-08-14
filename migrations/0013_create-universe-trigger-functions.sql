-- Up Migration
-- Mirrors SETUP_STEPS step 13: "Creating universe trigger functions"
--
-- Defined before the version tables that bind it (migration 0020) so the
-- function exists by the time the triggers reference it.

CREATE OR REPLACE FUNCTION universe.set_entity_type() RETURNS trigger AS $$
DECLARE
	expected_slug TEXT := TG_ARGV[0];
	type_record   RECORD;
	entity_table  TEXT;
	current_type  UUID;
BEGIN
	-- Look up the entity type by slug
	SELECT id INTO type_record FROM universe.entity_type WHERE slug = expected_slug;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Unknown entity type slug: %', expected_slug;
	END IF;

	-- Determine which entity table to update based on the version table name
	IF TG_TABLE_NAME LIKE 'public_%' THEN
		entity_table := 'universe.public_entity';
	ELSE
		entity_table := 'universe.org_entity';
	END IF;

	-- Read the current type_id from the parent entity row
	EXECUTE format('SELECT type_id FROM %s WHERE id = $1', entity_table)
		INTO current_type USING NEW.entity_id;

	IF current_type IS NULL THEN
		-- First version insert — stamp the entity type
		EXECUTE format('UPDATE %s SET type_id = $1 WHERE id = $2', entity_table)
			USING type_record.id, NEW.entity_id;
	ELSIF current_type != type_record.id THEN
		-- Entity already typed as something different — reject
		RAISE EXCEPTION 'Entity % already has type_id %, cannot insert version of type %',
			NEW.entity_id, current_type, type_record.id;
	END IF;
	-- If current_type matches expected, do nothing

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

DROP FUNCTION IF EXISTS universe.set_entity_type() CASCADE;
