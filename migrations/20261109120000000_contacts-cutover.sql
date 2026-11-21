-- Up Migration
-- Moves lists, turfs, and every read of locations onto contacts and their
-- addresses (issue #237). Ships with the code that stops writing
-- universe.org_location.
--
-- Before deploying, run scripts/backfill-addresses.ts --apply with the app in
-- maintenance mode: it copies every location version written since the last
-- run into a contact version with the same id. This migration refuses to run
-- while any location version has no contact.
--
--   - list_entry: location entries become 'org_contact' entries. Every one
--     records its address version (filled for entries made since the address
--     pins migration), and must from now on.
--   - turf_location: org_location_id becomes contact_id, a foreign key to the
--     contact version, and every door records its address version.
--   - Contacts get an entity type of their own, 'contact', in place of the
--     'location' type they shared with org_location.
--   - universe.v_locations is replaced by universe.v_contacts, which reads
--     current contacts at their current addresses in the flat location shape.
--
-- universe.org_location itself is kept, unread and unwritten, as the record
-- the backfill copied from. Its trigger is dropped so nothing can type an
-- entity as a location again.

INSERT INTO universe.entity_type (slug, name, description) VALUES
	('contact', 'Contact', 'Someone or something canvassed at an address: a person, a place, or a thing');

DROP TRIGGER set_entity_type ON universe.org_location;
DROP TRIGGER set_entity_type ON universe.org_contact;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.org_contact
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('contact');

ALTER TABLE universe.list_entry DROP CONSTRAINT list_entry_record_source_check;

-- The tables are under forced row-level security, so each org is changed with
-- its own id set.
DO $$
DECLARE
	org RECORD;
	missing INTEGER;
	contact_type UUID := (SELECT id FROM universe.entity_type WHERE slug = 'contact');
BEGIN
	FOR org IN SELECT id FROM auth.organization LOOP
		PERFORM set_config('app.current_org_id', org.id::text, true);

		SELECT count(*) INTO missing
		FROM universe.org_location ol
		WHERE ol.org_id = org.id
		  AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.id = ol.id);
		IF missing > 0 THEN
			RAISE EXCEPTION 'Organization % has % location versions with no contact: run scripts/backfill-addresses.ts --apply first', org.id, missing;
		END IF;

		UPDATE universe.org_entity e SET type_id = contact_type
		WHERE e.org_id = org.id
		  AND EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.entity_id = e.id);

		-- Entries and doors made since the address pins migration, filled by the
		-- same rule: the address version in force when the list or turf was
		-- made, or the earliest one if the address did not exist yet.
		UPDATE universe.list_entry le
		SET address_id = (
			SELECT a.id FROM universe.org_address a
			WHERE a.entity_id = c.address_entity_id
			ORDER BY (a.valid_from <= l.created_at) DESC,
			         CASE WHEN a.valid_from <= l.created_at THEN a.valid_from END DESC NULLS LAST,
			         a.valid_from ASC, a.created_at ASC
			LIMIT 1)
		FROM universe.list l, universe.org_contact c
		WHERE l.id = le.list_id AND l.org_id = org.id
		  AND le.record_source = 'org_location' AND c.id = le.record_id
		  AND le.address_id IS NULL;

		UPDATE universe.turf_location tl
		SET address_id = (
			SELECT a.id FROM universe.org_address a
			WHERE a.entity_id = c.address_entity_id
			ORDER BY (a.valid_from <= t.created_at) DESC,
			         CASE WHEN a.valid_from <= t.created_at THEN a.valid_from END DESC NULLS LAST,
			         a.valid_from ASC, a.created_at ASC
			LIMIT 1)
		FROM universe.turf t, universe.org_contact c
		WHERE t.id = tl.turf_id AND tl.org_id = org.id AND c.id = tl.org_location_id
		  AND tl.address_id IS NULL;

		UPDATE universe.list_entry le SET record_source = 'org_contact'
		FROM universe.list l
		WHERE l.id = le.list_id AND l.org_id = org.id AND le.record_source = 'org_location';

		SELECT count(*) INTO missing
		FROM universe.list_entry le
		JOIN universe.list l ON l.id = le.list_id
		WHERE l.org_id = org.id AND le.record_source = 'org_contact' AND le.address_id IS NULL;
		IF missing > 0 THEN
			RAISE EXCEPTION 'Organization % has % list entries whose contact has no address', org.id, missing;
		END IF;

		SELECT count(*) INTO missing
		FROM universe.turf_location tl
		WHERE tl.org_id = org.id AND tl.address_id IS NULL;
		IF missing > 0 THEN
			RAISE EXCEPTION 'Organization % has % turf doors whose contact has no address', org.id, missing;
		END IF;
	END LOOP;
	PERFORM set_config('app.current_org_id', '', true);
END $$;

-- An entry the migration could not see (an org row RLS hid) fails here rather
-- than being left behind.
ALTER TABLE universe.list_entry ADD CONSTRAINT list_entry_record_source_check
	CHECK (record_source IN ('org_person', 'org_contact'));
ALTER TABLE universe.list_entry ADD CONSTRAINT list_entry_contact_address_check
	CHECK (record_source <> 'org_contact' OR address_id IS NOT NULL);

ALTER TABLE universe.turf_location DROP CONSTRAINT turf_location_org_location_id_fkey;
ALTER TABLE universe.turf_location RENAME COLUMN org_location_id TO contact_id;
ALTER TABLE universe.turf_location ADD CONSTRAINT turf_location_contact_id_fkey
	FOREIGN KEY (contact_id) REFERENCES universe.org_contact(id) ON DELETE CASCADE;
ALTER TABLE universe.turf_location ALTER COLUMN address_id SET NOT NULL;
ALTER INDEX universe.turf_location_org_unique RENAME TO turf_location_contact_unique;
ALTER INDEX universe.turf_location_org_location_idx RENAME TO turf_location_contact_idx;

DROP VIEW universe.v_locations;

-- Current contacts at their current addresses, in the flat location shape the
-- filters and pages use. A volunteer's addition stays out until it is
-- approved. The expressions match $lib/server/services/contact-columns.ts.
CREATE VIEW universe.v_contacts AS
	SELECT
		c.id,
		'org_contact'::text AS source,
		c.entity_id,
		c.type,
		c.metadata,
		NULLIF(c.metadata->>'name', '') AS name,
		COALESCE(
			NULLIF(concat_ws(' ', a.premises_number, a.thoroughfare_pre_qualifier, a.thoroughfare_name,
			                      a.thoroughfare_type, a.thoroughfare_post_qualifier), ''),
			a.premises_name) AS address_line_1,
		NULLIF(concat_ws(' ', a.unit_type, a.unit_identifier), '') AS address_line_2,
		a.locality AS city,
		a.region AS state_or_region,
		a.postcode AS postal_code,
		a.country_code::text AS country_code,
		a.coordinates,
		c.photo_keys,
		a.id AS address_id,
		c.address_entity_id
	FROM universe.org_contact c
	JOIN universe.org_address a
	  ON a.entity_id = c.address_entity_id AND a.org_id = c.org_id AND a.valid_to IS NULL
	WHERE c.valid_to IS NULL
	  AND c.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
	  AND NOT EXISTS (
		SELECT 1 FROM universe.location_suggestion ls
		WHERE ls.entity_id = c.entity_id AND ls.status = 'tentative'
	  );

-- Down Migration
