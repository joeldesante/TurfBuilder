-- Up Migration
-- Mirrors SETUP_STEPS step 33: "Creating location correction proposals"
--
-- A canvasser standing in front of a door can see when the record is wrong.
-- The correction cannot be written into the location itself, because that would
-- change the official dataset before anyone has checked it, so the proposed
-- values are parked here until an organizer approves them. On approval they
-- become a new version of the location; the photos are the evidence the
-- organizer reviews.
--
-- The target is an entity rather than a version row so a proposal survives the
-- location being edited underneath it. Exactly one of the two entity columns is
-- set: public locations belong to the shared pool and cannot be written, so
-- approving a correction against one forks an org-private copy instead.

CREATE TABLE IF NOT EXISTS universe.location_edit_suggestion (
	id                UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	org_id            UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
	org_entity_id     UUID REFERENCES universe.org_entity(id) ON DELETE CASCADE,
	public_entity_id  UUID REFERENCES universe.public_entity(id) ON DELETE CASCADE,
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

DO $$ BEGIN
	ALTER TABLE universe.location_edit_suggestion
		ADD CONSTRAINT location_edit_suggestion_target_check CHECK (
			(org_entity_id IS NOT NULL AND public_entity_id IS NULL) OR
			(org_entity_id IS NULL AND public_entity_id IS NOT NULL)
		);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS location_edit_suggestion_org_id_idx
	ON universe.location_edit_suggestion (org_id);
CREATE INDEX IF NOT EXISTS location_edit_suggestion_org_entity_idx
	ON universe.location_edit_suggestion (org_entity_id) WHERE org_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS location_edit_suggestion_public_entity_idx
	ON universe.location_edit_suggestion (public_entity_id) WHERE public_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS location_edit_suggestion_turf_location_idx
	ON universe.location_edit_suggestion (turf_location_id);
CREATE INDEX IF NOT EXISTS location_edit_suggestion_user_id_idx
	ON universe.location_edit_suggestion (user_id);
CREATE INDEX IF NOT EXISTS location_edit_suggestion_pending_idx
	ON universe.location_edit_suggestion (org_id, created_at DESC) WHERE status = 'pending';

ALTER TABLE universe.location_edit_suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.location_edit_suggestion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.location_edit_suggestion;
CREATE POLICY org_isolation ON universe.location_edit_suggestion
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP TABLE IF EXISTS universe.location_edit_suggestion CASCADE;
