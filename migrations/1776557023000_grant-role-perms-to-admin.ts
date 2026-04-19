import type { MigrationBuilder } from 'node-pg-migrate';

// Grant all role.* permissions to every Administrator role (weight = 0) across all orgs.
// New orgs already receive these automatically via the afterCreateOrganization hook which
// selects all registered_permission keys scoped to 'organization'.
export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
		SELECT pr.id, rp.id, true
		FROM permission_role pr
		CROSS JOIN registered_permission rp
		WHERE pr.weight = 0
		  AND pr.scope = 'organization'
		  AND rp.key IN ('role.create', 'role.read', 'role.update', 'role.delete')
		ON CONFLICT (role_id, registered_permission_id) DO NOTHING
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		DELETE FROM permission_role_entry
		WHERE registered_permission_id IN (
			SELECT id FROM registered_permission
			WHERE key IN ('role.create', 'role.read', 'role.update', 'role.delete')
		)
		AND role_id IN (
			SELECT id FROM permission_role WHERE weight = 0 AND scope = 'organization'
		)
	`);
}
