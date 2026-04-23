import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';
import { PgLiteral } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions = {
	id: {
		type: 'uuid',
		notNull: true,
		primaryKey: true,
		default: new PgLiteral('gen_random_uuid()')
	},
	time_stamp: {
		type: 'timestamp',
		notNull: true,
		default: new PgLiteral('now()')
	}
};

const safe = `NULLIF(current_setting('app.current_org_id', true), '')::uuid`;

export async function up(pgm: MigrationBuilder): Promise<void> {
	// -------------------------------------------------------------------------
	// org_location: Tier 2 org-private locations, physically separate from
	// the shared Tier 1 `location` table so a data accident can never expose
	// private rows to the public.
	// -------------------------------------------------------------------------
	pgm.createTable('org_location', {
		id: 'id',
		organization_id: {
			type: 'uuid',
			notNull: true,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		},
		location_name: { type: 'text' },
		category: { type: 'text' },
		confidence: { type: 'text' },
		street: { type: 'text' },
		locality: { type: 'text' },
		postcode: { type: 'text' },
		region: { type: 'text' },
		country: { type: 'text' },
		latitude: { type: 'numeric(10,8)', notNull: true },
		longitude: { type: 'numeric(11,8)', notNull: true },
		geom: { type: 'geometry(point, 4326)' },
		created_at: 'time_stamp',
		updated_at: 'time_stamp'
	});

	pgm.createIndex('org_location', ['organization_id'], { name: 'org_location_org_id_idx' });
	pgm.createIndex('org_location', ['category'], { name: 'org_location_category_idx' });
	pgm.createIndex('org_location', ['geom'], { method: 'gist', name: 'org_location_geom_idx' });

	pgm.createTrigger('org_location', 'org_location_geom_trigger', {
		when: 'BEFORE',
		operation: ['INSERT', 'UPDATE'],
		function: 'update_geometry',
		level: 'ROW'
	});

	pgm.sql(`ALTER TABLE org_location ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE org_location FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON org_location
		USING (organization_id = ${safe})
		WITH CHECK (organization_id = ${safe})
	`);

	pgm.sql(`GRANT SELECT, INSERT, UPDATE, DELETE ON org_location TO turfbuilder_app`);

	// -------------------------------------------------------------------------
	// turf_location: add org_location_id FK alongside the existing location_id.
	// Exactly one of the two must be set (CHECK constraint enforces this).
	// -------------------------------------------------------------------------

	// Make location_id nullable — it will be NULL when org_location_id is set.
	pgm.sql(`ALTER TABLE turf_location ALTER COLUMN location_id DROP NOT NULL`);

	pgm.addColumn('turf_location', {
		org_location_id: {
			type: 'uuid',
			notNull: false,
			references: 'org_location(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.createIndex('turf_location', ['org_location_id'], {
		name: 'turf_location_org_location_id_idx'
	});

	// Enforce exactly-one-tier invariant.
	pgm.addConstraint('turf_location', 'turf_location_tier_check', `
		CHECK (
			(location_id IS NOT NULL AND org_location_id IS NULL) OR
			(location_id IS NULL AND org_location_id IS NOT NULL)
		)
	`);

	// Replace the old broad unique constraint with per-tier partial indexes.
	pgm.dropConstraint('turf_location', 'turf_locations_turf_id_location_id_key');
	pgm.createIndex('turf_location', ['turf_id', 'location_id'], {
		name: 'turf_location_tier1_unique',
		unique: true,
		where: 'location_id IS NOT NULL'
	});
	pgm.createIndex('turf_location', ['turf_id', 'org_location_id'], {
		name: 'turf_location_tier2_unique',
		unique: true,
		where: 'org_location_id IS NOT NULL'
	});

	// -------------------------------------------------------------------------
	// location_unified: read-only view used for geography-first searches
	// (viewport bounding box, ST_Contains auto-assign). Not used when reading
	// turf locations — those use the COALESCE double-join directly.
	//
	// RLS is inherited: org_location rows are filtered by the current org
	// context; location rows are always visible (public Tier 1 data).
	// The `tier` column tells callers which FK column to set in turf_location.
	// -------------------------------------------------------------------------
	pgm.sql(`
		CREATE VIEW location_unified AS
			SELECT
				id,
				NULL::uuid AS organization_id,
				location_name, category, confidence,
				street, locality, postcode, region, country,
				latitude, longitude, geom,
				created_at, updated_at,
				'tier1'::text AS tier
			FROM location
		UNION ALL
			SELECT
				id,
				organization_id,
				location_name, category, confidence,
				street, locality, postcode, region, country,
				latitude, longitude, geom,
				created_at, updated_at,
				'tier2'::text AS tier
			FROM org_location
	`);

	pgm.sql(`GRANT SELECT ON location_unified TO turfbuilder_app`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`DROP VIEW IF EXISTS location_unified`);

	pgm.dropIndex('turf_location', [], { name: 'turf_location_tier2_unique' });
	pgm.dropIndex('turf_location', [], { name: 'turf_location_tier1_unique' });
	pgm.dropConstraint('turf_location', 'turf_location_tier_check');
	pgm.dropIndex('turf_location', [], { name: 'turf_location_org_location_id_idx' });
	pgm.dropColumn('turf_location', 'org_location_id');
	pgm.sql(`ALTER TABLE turf_location ALTER COLUMN location_id SET NOT NULL`);
	pgm.addConstraint('turf_location', 'turf_locations_turf_id_location_id_key', {
		unique: ['turf_id', 'location_id']
	});

	pgm.dropTrigger('org_location', 'org_location_geom_trigger');
	pgm.sql(`DROP POLICY IF EXISTS org_isolation ON org_location`);
	pgm.dropTable('org_location');
}
