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

export async function up(pgm: MigrationBuilder): Promise<void> {
	// Roles defined per org. is_owner bypasses all permission checks.
	// is_default is auto-assigned to new members on join.
	pgm.createTable('org_role', {
		id: 'id',
		org_id: {
			type: 'uuid',
			notNull: true,
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		name: { type: 'text', notNull: true },
		is_owner: { type: 'boolean', notNull: true, default: false },
		is_default: { type: 'boolean', notNull: true, default: false },
		created_at: 'time_stamp'
	});

	pgm.addConstraint('org_role', 'org_role_org_name_unique', {
		unique: ['org_id', 'name']
	});

	pgm.createIndex('org_role', 'org_id', { name: 'org_role_org_id_idx' });

	// Explicit permission grants per role.
	// resource: 'survey' | 'turf' | 'response' | 'member' | 'role'
	// action: 'create' | 'read' | 'update' | 'delete'
	pgm.createTable('org_role_permission', {
		id: 'id',
		role_id: {
			type: 'uuid',
			notNull: true,
			references: 'org_role',
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		resource: { type: 'text', notNull: true },
		action: { type: 'text', notNull: true },
		created_at: 'time_stamp'
	});

	pgm.addConstraint('org_role_permission', 'org_role_permission_role_resource_action_unique', {
		unique: ['role_id', 'resource', 'action']
	});

	pgm.createIndex('org_role_permission', 'role_id', { name: 'org_role_permission_role_id_idx' });

	// Maps a user to their role within an org.
	// Separate from auth.member which just tracks membership.
	pgm.createTable('org_user_role', {
		id: 'id',
		org_id: {
			type: 'uuid',
			notNull: true,
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		user_id: {
			type: 'uuid',
			notNull: true,
			references: { schema: 'auth', name: 'user' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		role_id: {
			type: 'uuid',
			notNull: true,
			references: 'org_role',
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		created_at: 'time_stamp'
	});

	pgm.addConstraint('org_user_role', 'org_user_role_org_user_unique', {
		unique: ['org_id', 'user_id']
	});

	pgm.createIndex('org_user_role', ['org_id', 'user_id'], { name: 'org_user_role_org_user_idx' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropTable('org_user_role');
	pgm.dropTable('org_role_permission');
	pgm.dropTable('org_role');
}
