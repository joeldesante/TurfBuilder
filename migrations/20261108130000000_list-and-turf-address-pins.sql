-- Up Migration
-- Lists and turfs are snapshots: they must keep the address a door had when
-- they were made. A contact points at an address entity, not at one address
-- version, so each list entry and turf door now records the address version
-- itself. This step only adds and fills the column; the code still reads the
-- old columns, and a later migration (with the code that switches over) points
-- turf doors at contacts and makes the column required.
--
-- The backfill gave every location version a contact version with the same id,
-- so list_entry.record_id and turf_location.org_location_id already name the
-- right contact. Run scripts/backfill-addresses.ts --apply before this.

ALTER TABLE universe.list_entry ADD COLUMN address_id UUID REFERENCES universe.org_address(id);
ALTER TABLE universe.turf_location ADD COLUMN address_id UUID REFERENCES universe.org_address(id);

CREATE INDEX list_entry_address_idx ON universe.list_entry (address_id) WHERE address_id IS NOT NULL;
CREATE INDEX turf_location_address_idx ON universe.turf_location (address_id);

ALTER TABLE universe.list_entry DROP CONSTRAINT list_entry_record_source_check;
ALTER TABLE universe.list_entry ADD CONSTRAINT list_entry_record_source_check
	CHECK (record_source IN ('org_person', 'org_location', 'org_contact'));

-- The tables are under forced row-level security, so each org is filled with
-- its own id set.
DO $$
DECLARE
	org RECORD;
	missing INTEGER;
BEGIN
	FOR org IN SELECT id FROM auth.organization LOOP
		PERFORM set_config('app.current_org_id', org.id::text, true);

		SELECT count(*) INTO missing
		FROM universe.list_entry le
		JOIN universe.list l ON l.id = le.list_id
		WHERE l.org_id = org.id AND le.record_source = 'org_location'
		  AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.id = le.record_id);
		IF missing > 0 THEN
			RAISE EXCEPTION 'Organization % has % list entries with no contact: run scripts/backfill-addresses.ts --apply first', org.id, missing;
		END IF;

		SELECT count(*) INTO missing
		FROM universe.turf_location tl
		WHERE tl.org_id = org.id
		  AND NOT EXISTS (SELECT 1 FROM universe.org_contact c WHERE c.id = tl.org_location_id);
		IF missing > 0 THEN
			RAISE EXCEPTION 'Organization % has % turf doors with no contact: run scripts/backfill-addresses.ts --apply first', org.id, missing;
		END IF;

		-- The address version in force when the list was made, or the earliest
		-- one if the address did not exist yet.
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
		  AND le.record_source = 'org_location' AND c.id = le.record_id;

		UPDATE universe.turf_location tl
		SET address_id = (
			SELECT a.id FROM universe.org_address a
			WHERE a.entity_id = c.address_entity_id
			ORDER BY (a.valid_from <= t.created_at) DESC,
			         CASE WHEN a.valid_from <= t.created_at THEN a.valid_from END DESC NULLS LAST,
			         a.valid_from ASC, a.created_at ASC
			LIMIT 1)
		FROM universe.turf t, universe.org_contact c
		WHERE t.id = tl.turf_id AND tl.org_id = org.id AND c.id = tl.org_location_id;
	END LOOP;
END $$;

-- Down Migration
