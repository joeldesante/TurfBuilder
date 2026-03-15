import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';
import { PgLiteral } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.addColumn('survey', {
		organization_id: {
			type: 'uuid',
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
			notNull: false
		}
	});

	pgm.addColumn('turf', {
		organization_id: {
			type: 'uuid',
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
			notNull: false
		}
	});

	pgm.createIndex('survey', 'organization_id', { name: 'survey_org_id_idx' });
	pgm.createIndex('turf', 'organization_id', { name: 'turf_org_id_idx' });

	// Backfill existing rows to the first org (if any exist).
	// In a fresh database this is a no-op.
	pgm.sql(`
		UPDATE survey SET organization_id = (SELECT id FROM auth.organization ORDER BY created_at ASC LIMIT 1)
		WHERE organization_id IS NULL;

		UPDATE turf SET organization_id = (SELECT id FROM auth.organization ORDER BY created_at ASC LIMIT 1)
		WHERE organization_id IS NULL;
	`);

	// Only enforce NOT NULL if all rows have been backfilled.
	// Wrap in DO block so it's a no-op when no rows exist yet.
	pgm.sql(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM survey WHERE organization_id IS NULL) THEN
				ALTER TABLE survey ALTER COLUMN organization_id SET NOT NULL;
			END IF;
			IF NOT EXISTS (SELECT 1 FROM turf WHERE organization_id IS NULL) THEN
				ALTER TABLE turf ALTER COLUMN organization_id SET NOT NULL;
			END IF;
		END $$;
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropIndex('survey', 'organization_id', { name: 'survey_org_id_idx' });
	pgm.dropIndex('turf', 'organization_id', { name: 'turf_org_id_idx' });
	pgm.dropColumn('survey', 'organization_id');
	pgm.dropColumn('turf', 'organization_id');
}
