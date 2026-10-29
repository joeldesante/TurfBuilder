-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Creating location suggestions and photo storage

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

CREATE INDEX IF NOT EXISTS list_entry_record_id_idx
				ON universe.list_entry (record_id);

ALTER TABLE universe.location_suggestion ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.location_suggestion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.location_suggestion;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.location_suggestion
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

DROP VIEW IF EXISTS universe.v_locations;

DO $mig$ BEGIN
CREATE VIEW universe.v_locations AS
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
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating location correction proposals

CREATE TABLE IF NOT EXISTS universe.location_edit_suggestion (
				id                UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id            UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				org_entity_id     UUID NOT NULL REFERENCES universe.org_entity(id) ON DELETE CASCADE,
				turf_id           UUID REFERENCES universe.turf(id) ON DELETE SET NULL,
				turf_location_id  UUID REFERENCES universe.turf_location(id) ON DELETE SET NULL,
				user_id           UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
				status            TEXT NOT NULL DEFAULT 'pending'
				                    CHECK (status IN ('pending', 'approved', 'rejected')),
				name              TEXT,
				address_line_1    TEXT,
				address_line_2    TEXT,
				address_line_3    TEXT,
				city              TEXT,
				state_or_region   TEXT,
				postal_code       TEXT,
				country_code      TEXT,
				coordinates       geometry(point, 4326),
				photo_keys        TEXT[] NOT NULL DEFAULT '{}',
				note              TEXT,
				reviewed_by       UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				reviewed_at       TIMESTAMPTZ,
				created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
			);

CREATE INDEX IF NOT EXISTS location_edit_suggestion_org_id_idx
				ON universe.location_edit_suggestion (org_id);

CREATE INDEX IF NOT EXISTS location_edit_suggestion_org_entity_idx
				ON universe.location_edit_suggestion (org_entity_id);

CREATE INDEX IF NOT EXISTS location_edit_suggestion_turf_location_idx
				ON universe.location_edit_suggestion (turf_location_id);

CREATE INDEX IF NOT EXISTS location_edit_suggestion_user_id_idx
				ON universe.location_edit_suggestion (user_id);

CREATE INDEX IF NOT EXISTS location_edit_suggestion_pending_idx
				ON universe.location_edit_suggestion (org_id, created_at DESC) WHERE status = 'pending';

ALTER TABLE universe.location_edit_suggestion ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.location_edit_suggestion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.location_edit_suggestion;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.location_edit_suggestion
					USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
					WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Creating list documents

CREATE TABLE IF NOT EXISTS universe.list_document (
				id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				org_id        UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
				list_id       UUID NOT NULL REFERENCES universe.list(id) ON DELETE CASCADE,
				storage_key   TEXT NOT NULL UNIQUE,
				status        TEXT NOT NULL DEFAULT 'pending'
				                CHECK (status IN ('pending', 'ready', 'failed')),
				error         TEXT,
				requested_by  UUID REFERENCES auth.user(id) ON DELETE SET NULL,
				created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
				completed_at  TIMESTAMPTZ,
				deleted_at    TIMESTAMPTZ,
				superseded_by UUID REFERENCES universe.list_document(id) ON DELETE SET NULL
			);

ALTER TABLE universe.list_document ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE universe.list_document ADD COLUMN IF NOT EXISTS superseded_by UUID
				REFERENCES universe.list_document(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS list_document_superseded_by_idx
				ON universe.list_document (superseded_by) WHERE superseded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS list_document_org_id_idx ON universe.list_document (org_id);

CREATE INDEX IF NOT EXISTS list_document_list_id_idx
				ON universe.list_document (list_id, created_at DESC);

ALTER TABLE universe.list_document ENABLE ROW LEVEL SECURITY;

ALTER TABLE universe.list_document FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.list_document;

DO $mig$ BEGIN
CREATE POLICY org_isolation ON universe.list_document
				USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
				WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Adding filter editor documents to buckets and lists

ALTER TABLE universe.bucket ADD COLUMN IF NOT EXISTS filters JSONB;

ALTER TABLE universe.bucket ALTER COLUMN filter DROP NOT NULL;

COMMENT ON COLUMN universe.bucket.filters IS
				'The filter editor document (a FilterGroup) for this bucket. Replaces the compiled query in filter.';

ALTER TABLE universe.list ADD COLUMN IF NOT EXISTS filters JSONB;

COMMENT ON COLUMN universe.list.filters IS
				'The filter editor document the list was created with. A reference only, since the list is a snapshot; immutable once set.';

CREATE OR REPLACE FUNCTION universe.lock_list_filters() RETURNS trigger AS $$
			BEGIN
				IF OLD.filters IS NOT NULL AND NEW.filters IS DISTINCT FROM OLD.filters THEN
					RAISE EXCEPTION 'universe.list.filters cannot be changed once set';
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS list_filters_immutable ON universe.list;

DO $mig$ BEGIN
CREATE TRIGGER list_filters_immutable
				BEFORE UPDATE OF filters ON universe.list
				FOR EACH ROW EXECUTE FUNCTION universe.lock_list_filters();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $mig$;

-- Down Migration
