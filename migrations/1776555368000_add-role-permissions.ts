import type { MigrationBuilder } from 'node-pg-migrate';

const ROLE_PERMISSIONS = [
	{ key: 'role.create', name: 'Create Roles',  description: 'Allows creating new permission groups (roles) within the organization.' },
	{ key: 'role.read',   name: 'View Roles',    description: 'Grants access to the Roles settings page to view all permission groups.' },
	{ key: 'role.update', name: 'Edit Roles',    description: 'Allows modifying the name, weight, and permission entries of existing roles.' },
	{ key: 'role.delete', name: 'Delete Roles',  description: 'Allows permanently removing permission groups from the organization.' },
];

export async function up(pgm: MigrationBuilder): Promise<void> {
	for (const p of ROLE_PERMISSIONS) {
		pgm.sql(`
			INSERT INTO registered_permission (key, name, description, scope)
			VALUES ('${p.key}', '${p.name}', '${p.description}', 'organization')
			ON CONFLICT (scope, key) DO NOTHING
		`);
	}
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		DELETE FROM permission_group_entry
		WHERE registered_permission_id IN (
			SELECT id FROM registered_permission
			WHERE key IN ('role.create', 'role.read', 'role.update', 'role.delete')
		)
	`);
	pgm.sql(`
		DELETE FROM registered_permission
		WHERE key IN ('role.create', 'role.read', 'role.update', 'role.delete')
	`);
}
