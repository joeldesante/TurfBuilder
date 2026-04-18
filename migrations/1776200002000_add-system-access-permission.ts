import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		INSERT INTO registered_permission (key, name, description, scope)
		VALUES (
			'system.access',
			'Staff Dashboard Access',
			'Grants access to the staff dashboard (/s/). Required to manage the organization.',
			'organization'
		)
		ON CONFLICT (scope, key) DO NOTHING
	`);

	// Grant to all existing Administrator groups (weight=0) and Organizer/Analyst groups
	// by giving it to any group that already has survey.read (a basic staff permission)
	pgm.sql(`
		INSERT INTO permission_group_entry (group_id, registered_permission_id, value)
		SELECT pg.id, rp.id, true
		FROM permission_group pg
		CROSS JOIN registered_permission rp
		WHERE rp.key = 'system.access'
		  AND pg.scope = 'organization'
		  AND pg.is_default = false
		ON CONFLICT (group_id, registered_permission_id) DO NOTHING
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		DELETE FROM permission_group_entry
		WHERE registered_permission_id = (
			SELECT id FROM registered_permission WHERE key = 'system.access'
		)
	`);
	pgm.sql(`DELETE FROM registered_permission WHERE key = 'system.access'`);
}
