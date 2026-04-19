import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		INSERT INTO registered_permission (key, name, description, scope)
		VALUES (
			'member.invite',
			'Invite Members',
			'Allows creating token-based invite links and toggling the open slug invite for the organization.',
			'organization'
		)
		ON CONFLICT (scope, key) DO NOTHING
	`);

	// Grant to all existing Administrator roles (weight = 0).
	pgm.sql(`
		INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
		SELECT pr.id, rp.id, true
		FROM permission_role pr
		CROSS JOIN registered_permission rp
		WHERE pr.weight = 0
		  AND pr.scope = 'organization'
		  AND rp.key = 'member.invite'
		ON CONFLICT (role_id, registered_permission_id) DO NOTHING
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		DELETE FROM permission_role_entry
		WHERE registered_permission_id = (
			SELECT id FROM registered_permission WHERE key = 'member.invite'
		)
	`);
	pgm.sql(`DELETE FROM registered_permission WHERE key = 'member.invite'`);
}
