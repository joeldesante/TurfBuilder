import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.createTable('system_setting', {
		key: { type: 'text', primaryKey: true },
		value: { type: 'text', notNull: true },
		description: { type: 'text' },
		updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
	});

	pgm.sql(`
		INSERT INTO system_setting (key, value, description) VALUES
			('organizations.allow_creation', 'true', 'Whether users can create new organizations.')
	`);

	pgm.sql(`
		INSERT INTO registered_permission (key, name, description, scope) VALUES
			('settings.manage', 'Manage System Settings', 'Allows viewing and editing system-wide settings.', 'infrastructure')
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropTable('system_setting');
	pgm.sql(`DELETE FROM registered_permission WHERE key = 'settings.manage' AND scope = 'infrastructure'`);
}
