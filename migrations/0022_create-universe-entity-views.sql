-- Up Migration
-- Mirrors SETUP_STEPS step 22: "Creating universe entity views"
--
-- Combines the shared public rows with the current org's private rows into one
-- queryable surface. PostgreSQL views bypass the underlying tables' RLS, so the
-- org filter is repeated explicitly in the WHERE clause.
--
-- v_locations is NOT defined here. It references location_suggestion, which
-- does not exist until migration 0032, and that is its only definition.
--
-- Deviation from setup-schema.ts: the source uses CREATE OR REPLACE VIEW. This
-- uses DROP + CREATE, matching the pattern the source already applies to
-- v_locations, because CREATE OR REPLACE VIEW cannot change a view's column
-- list and would fail on a database carrying an older shape. Nothing in the
-- database depends on this view.

DROP VIEW IF EXISTS universe.v_people;
CREATE VIEW universe.v_people AS
	SELECT
		pp.id,
		pp.first_name,
		pp.last_name,
		pp.email,
		pp.phone,
		pp.dob,
		'public_person' AS source
	FROM universe.public_person pp
	WHERE pp.valid_to IS NULL
	UNION ALL
	SELECT
		op.id,
		op.first_name,
		op.last_name,
		op.email,
		op.phone,
		op.dob,
		'org_person' AS source
	FROM universe.org_person op
	WHERE op.valid_to IS NULL
	  AND op.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid;

-- Down Migration

DROP VIEW IF EXISTS universe.v_people;
