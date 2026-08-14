-- Up Migration
-- Mirrors SETUP_STEPS step 32: "Creating location suggestions and photo storage"
--
-- Volunteers can suggest new locations from the field. A suggestion is workflow
-- state about an entity, not an attribute of it, so it lives in its own table
-- rather than forking a new org_location version on every status change. Photo
-- keys reference objects in the Spaces bucket.
--
-- Runs after 0030 because location_suggestion references universe.turf.

ALTER TABLE universe.org_location
	ADD COLUMN IF NOT EXISTS photo_keys TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS universe.location_suggestion (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id      UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	entity_id   UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
	turf_id     UUID REFERENCES universe.turf(id) ON DELETE SET NULL,
	user_id     UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
	status      TEXT NOT NULL DEFAULT 'tentative'
	              CHECK (status IN ('tentative', 'approved')),
	reviewed_by UUID REFERENCES auth.user(id) ON DELETE SET NULL,
	reviewed_at TIMESTAMPTZ,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS location_suggestion_entity_unique
	ON universe.location_suggestion (entity_id);
CREATE INDEX IF NOT EXISTS location_suggestion_org_id_idx
	ON universe.location_suggestion (org_id);
CREATE INDEX IF NOT EXISTS location_suggestion_turf_id_idx
	ON universe.location_suggestion (turf_id);
CREATE INDEX IF NOT EXISTS location_suggestion_user_id_idx
	ON universe.location_suggestion (user_id);
CREATE INDEX IF NOT EXISTS location_suggestion_pending_idx
	ON universe.location_suggestion (org_id, created_at DESC) WHERE status = 'tentative';

-- Required by createLocationVersion, which repoints list_entry rows from a
-- superseded org_location version to its successor.
CREATE INDEX IF NOT EXISTS list_entry_record_id_idx
	ON universe.list_entry (record_id);

ALTER TABLE universe.location_suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.location_suggestion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.location_suggestion;
CREATE POLICY org_isolation ON universe.location_suggestion
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- The only definition of v_locations; migration 0022 deliberately leaves it
-- out. Dropped rather than replaced so a rerun against a database carrying an
-- older column shape converges instead of failing, since CREATE OR REPLACE VIEW
-- cannot change a view's columns. Nothing depends on it as a database object.
DROP VIEW IF EXISTS universe.v_locations;
CREATE VIEW universe.v_locations AS
	SELECT
		pl.id,
		pl.name,
		pl.address_line_1,
		pl.address_line_2,
		pl.address_line_3,
		pl.city,
		pl.state_or_region,
		pl.postal_code,
		pl.country_code,
		pl.coordinates,
		'public_location' AS source,
		pl.entity_id,
		ARRAY[]::text[] AS photo_keys
	FROM universe.public_location pl
	WHERE pl.valid_to IS NULL
	UNION ALL
	SELECT
		ol.id,
		ol.name,
		ol.address_line_1,
		ol.address_line_2,
		ol.address_line_3,
		ol.city,
		ol.state_or_region,
		ol.postal_code,
		ol.country_code,
		ol.coordinates,
		'org_location' AS source,
		ol.entity_id,
		ol.photo_keys
	FROM universe.org_location ol
	WHERE ol.valid_to IS NULL
	  AND ol.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
	  AND NOT EXISTS (
		SELECT 1 FROM universe.location_suggestion ls
		WHERE ls.entity_id = ol.entity_id
		  AND ls.status = 'tentative'
	  );

-- Down Migration

DROP VIEW IF EXISTS universe.v_locations;
DROP INDEX IF EXISTS universe.list_entry_record_id_idx;
DROP TABLE IF EXISTS universe.location_suggestion CASCADE;
ALTER TABLE universe.org_location DROP COLUMN IF EXISTS photo_keys;
