import type { MigrationBuilder } from 'node-pg-migrate';

const safe = `NULLIF(current_setting('app.current_org_id', true), '')::uuid`;

export async function up(pgm: MigrationBuilder): Promise<void> {
	// Move any existing org-private location rows into org_location, preserving
	// their id so existing turf_location FK references remain valid during the
	// remap step below.
	pgm.sql(`
		INSERT INTO org_location (
			id, organization_id, location_name, category, confidence,
			street, locality, postcode, region, country,
			latitude, longitude, geom, created_at, updated_at
		)
		SELECT
			id, organization_id, location_name, category, confidence,
			street, locality, postcode, region, country,
			latitude, longitude, geom, created_at, updated_at
		FROM location
		WHERE organization_id IS NOT NULL
	`);

	// Remap turf_location rows that pointed at the migrated location rows.
	pgm.sql(`
		UPDATE turf_location tl
		SET org_location_id = tl.location_id,
		    location_id = NULL
		FROM location l
		WHERE tl.location_id = l.id
		  AND l.organization_id IS NOT NULL
	`);

	// Remove the migrated rows from the public Tier 1 table.
	pgm.sql(`DELETE FROM location WHERE organization_id IS NOT NULL`);

	// Drop the RLS policy first — it references organization_id and blocks the column drop.
	pgm.sql(`DROP POLICY IF EXISTS location_visibility ON location`);

	// Strip organization_id from location — Tier 1 data is always public.
	pgm.dropIndex('location', [], { name: 'location_org_id_idx' });
	pgm.dropColumn('location', 'organization_id');
	pgm.sql(`
		CREATE POLICY location_public_read ON location
		FOR ALL
		USING (true)
		WITH CHECK (true)
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`DROP POLICY IF EXISTS location_public_read ON location`);

	pgm.addColumn('location', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});
	pgm.createIndex('location', ['organization_id'], { name: 'location_org_id_idx' });

	// Copy rows back from org_location that aren't already in location.
	pgm.sql(`
		INSERT INTO location (
			id, organization_id, location_name, category, confidence,
			street, locality, postcode, region, country,
			latitude, longitude, geom, created_at, updated_at
		)
		SELECT
			id, organization_id, location_name, category, confidence,
			street, locality, postcode, region, country,
			latitude, longitude, geom, created_at, updated_at
		FROM org_location
		WHERE id NOT IN (SELECT id FROM location)
	`);

	// Restore turf_location FK pointers.
	pgm.sql(`
		UPDATE turf_location tl
		SET location_id = tl.org_location_id,
		    org_location_id = NULL
		WHERE tl.org_location_id IS NOT NULL
		  AND EXISTS (SELECT 1 FROM location l WHERE l.id = tl.org_location_id)
	`);

	// Restore the two-tier RLS policy.
	pgm.sql(`
		CREATE POLICY location_visibility ON location
		USING (
			organization_id IS NULL
			OR organization_id = ${safe}
		)
		WITH CHECK (
			organization_id IS NULL
			OR organization_id = ${safe}
		)
	`);
}
