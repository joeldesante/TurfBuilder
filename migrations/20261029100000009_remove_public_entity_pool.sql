-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Removing the public entity pool

DROP VIEW IF EXISTS universe.v_location_survey_response;

DROP VIEW IF EXISTS universe.v_location_attempt;

DELETE FROM universe.list_entry WHERE record_source IN ('public_person', 'public_location');

DO $$ BEGIN
						IF EXISTS (
							SELECT 1 FROM information_schema.columns
							WHERE table_schema = 'universe'
							  AND table_name = 'turf_location'
							  AND column_name = 'public_location_id'
						) THEN
							DELETE FROM universe.turf_location WHERE public_location_id IS NOT NULL;
						END IF;
					END $$;

DO $$ BEGIN
						IF EXISTS (
							SELECT 1 FROM information_schema.columns
							WHERE table_schema = 'universe'
							  AND table_name = 'location_edit_suggestion'
							  AND column_name = 'public_entity_id'
						) THEN
							DELETE FROM universe.location_edit_suggestion WHERE public_entity_id IS NOT NULL;
						END IF;
					END $$;

DO $$ BEGIN
						IF EXISTS (
							SELECT 1 FROM information_schema.columns
							WHERE table_schema = 'universe'
							  AND table_name = 'org_relationship'
							  AND column_name = 'from_public_entity_id'
						) THEN
							DELETE FROM universe.org_relationship WHERE from_public_entity_id IS NOT NULL;
						END IF;
					END $$;

DO $$ BEGIN
						IF EXISTS (
							SELECT 1 FROM information_schema.columns
							WHERE table_schema = 'universe'
							  AND table_name = 'org_relationship'
							  AND column_name = 'to_public_entity_id'
						) THEN
							DELETE FROM universe.org_relationship WHERE to_public_entity_id IS NOT NULL;
						END IF;
					END $$;

DO $$ BEGIN
						IF EXISTS (
							SELECT 1 FROM information_schema.columns
							WHERE table_schema = 'universe'
							  AND table_name = 'entity_tag'
							  AND column_name = 'public_entity_id'
						) THEN
							DELETE FROM universe.entity_tag WHERE public_entity_id IS NOT NULL;
						END IF;
					END $$;

ALTER TABLE universe.list_entry DROP CONSTRAINT IF EXISTS list_entry_record_source_check;

DO $$ BEGIN
				ALTER TABLE universe.list_entry ADD CONSTRAINT list_entry_record_source_check
					CHECK (record_source IN ('org_person', 'org_location'));
			EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

ALTER TABLE universe.turf_location DROP COLUMN IF EXISTS public_location_id;

ALTER TABLE universe.turf_location ALTER COLUMN org_location_id SET NOT NULL;

ALTER TABLE universe.location_edit_suggestion DROP COLUMN IF EXISTS public_entity_id;

ALTER TABLE universe.location_edit_suggestion ALTER COLUMN org_entity_id SET NOT NULL;

ALTER TABLE universe.org_relationship DROP COLUMN IF EXISTS from_public_entity_id;

ALTER TABLE universe.org_relationship DROP COLUMN IF EXISTS to_public_entity_id;

ALTER TABLE universe.org_relationship ALTER COLUMN from_org_entity_id SET NOT NULL;

ALTER TABLE universe.org_relationship ALTER COLUMN to_org_entity_id SET NOT NULL;

ALTER TABLE universe.entity_tag DROP COLUMN IF EXISTS public_entity_id;

ALTER TABLE universe.entity_tag ALTER COLUMN org_entity_id SET NOT NULL;

DROP TABLE IF EXISTS universe.public_relationship;

DROP TABLE IF EXISTS universe.public_person;

DROP TABLE IF EXISTS universe.public_organization;

DROP TABLE IF EXISTS universe.public_location;

DROP TABLE IF EXISTS universe.public_entity;

-- Down Migration
