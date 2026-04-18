import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	// -------------------------------------------------------------------------
	// location: add nullable organization_id (NULL = global shared, non-null = org-private)
	// -------------------------------------------------------------------------
	pgm.addColumn('location', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.dropConstraint('location', 'location_name_unique', { ifExists: true });

	pgm.createIndex('location', ['organization_id'], { name: 'location_org_id_idx' });

	// -------------------------------------------------------------------------
	// survey_question: add organization_id, backfill from survey
	// -------------------------------------------------------------------------
	pgm.addColumn('survey_question', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.sql(`
		UPDATE survey_question sq
		SET organization_id = s.organization_id
		FROM survey s
		WHERE sq.survey_id = s.id
	`);

	// Delete any orphaned questions (no matching survey) so NOT NULL can be enforced.
	pgm.sql(`DELETE FROM survey_question WHERE organization_id IS NULL`);

	pgm.alterColumn('survey_question', 'organization_id', { notNull: true });
	pgm.createIndex('survey_question', ['organization_id'], { name: 'survey_question_org_id_idx' });

	// -------------------------------------------------------------------------
	// turf_location: add organization_id, backfill from turf
	// -------------------------------------------------------------------------
	pgm.addColumn('turf_location', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.sql(`
		UPDATE turf_location tl
		SET organization_id = t.organization_id
		FROM turf t
		WHERE tl.turf_id = t.id
	`);

	pgm.sql(`
		UPDATE turf_location
		SET organization_id = '352294a3-48a3-4a40-a966-8d73a8a51b46'
		WHERE organization_id IS NULL
	`);

	pgm.alterColumn('turf_location', 'organization_id', { notNull: true });
	pgm.createIndex('turf_location', ['organization_id'], { name: 'turf_location_org_id_idx' });

	// -------------------------------------------------------------------------
	// turf_user: add organization_id, backfill from turf
	// -------------------------------------------------------------------------
	pgm.addColumn('turf_user', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.sql(`
		UPDATE turf_user tu
		SET organization_id = t.organization_id
		FROM turf t
		WHERE tu.turf_id = t.id
	`);

	pgm.sql(`
		UPDATE turf_user
		SET organization_id = '352294a3-48a3-4a40-a966-8d73a8a51b46'
		WHERE organization_id IS NULL
	`);

	pgm.alterColumn('turf_user', 'organization_id', { notNull: true });
	pgm.createIndex('turf_user', ['organization_id'], { name: 'turf_user_org_id_idx' });

	// -------------------------------------------------------------------------
	// turf_location_attempt: add organization_id, backfill via turf_location -> turf
	// -------------------------------------------------------------------------
	pgm.addColumn('turf_location_attempt', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.sql(`
		UPDATE turf_location_attempt tla
		SET organization_id = t.organization_id
		FROM turf_location tl
		JOIN turf t ON t.id = tl.turf_id
		WHERE tla.turf_location_id = tl.id
	`);

	pgm.sql(`
		UPDATE turf_location_attempt
		SET organization_id = '352294a3-48a3-4a40-a966-8d73a8a51b46'
		WHERE organization_id IS NULL
	`);

	pgm.alterColumn('turf_location_attempt', 'organization_id', { notNull: true });
	pgm.createIndex('turf_location_attempt', ['organization_id'], {
		name: 'turf_location_attempt_org_id_idx'
	});

	// -------------------------------------------------------------------------
	// survey_question_response: add organization_id, backfill three hops up
	// -------------------------------------------------------------------------
	pgm.addColumn('survey_question_response', {
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		}
	});

	pgm.sql(`
		UPDATE survey_question_response sqr
		SET organization_id = t.organization_id
		FROM turf_location_attempt tla
		JOIN turf_location tl ON tl.id = tla.turf_location_id
		JOIN turf t ON t.id = tl.turf_id
		WHERE sqr.turf_location_attempt_id = tla.id
	`);

	pgm.sql(`
		UPDATE survey_question_response
		SET organization_id = '352294a3-48a3-4a40-a966-8d73a8a51b46'
		WHERE organization_id IS NULL
	`);

	pgm.alterColumn('survey_question_response', 'organization_id', { notNull: true });
	pgm.createIndex('survey_question_response', ['organization_id'], {
		name: 'survey_question_response_org_id_idx'
	});
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropColumn('survey_question_response', 'organization_id');
	pgm.dropColumn('turf_location_attempt', 'organization_id');
	pgm.dropColumn('turf_user', 'organization_id');
	pgm.dropColumn('turf_location', 'organization_id');
	pgm.dropColumn('survey_question', 'organization_id');

	pgm.dropIndex('location', [], { name: 'location_org_id_idx' });
	pgm.dropColumn('location', 'organization_id');

	pgm.addConstraint('location', 'location_name_unique', 'UNIQUE (location_name)');
}
