import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.createTable('org_invite_link', {
		id: { type: 'text', primaryKey: true, notNull: true },
		org_id: {
			type: 'uuid',
			notNull: true,
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		created_by: {
			type: 'uuid',
			notNull: true,
			references: { schema: 'auth', name: 'user' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		expires_at: { type: 'timestamp', notNull: false },
		created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
	});

	pgm.createIndex('org_invite_link', 'org_id', { name: 'org_invite_link_org_id_idx' });

	pgm.createTable('org_slug_invite', {
		org_id: {
			type: 'uuid',
			primaryKey: true,
			notNull: true,
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		enabled: { type: 'boolean', notNull: true, default: false }
	});
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropTable('org_slug_invite');
	pgm.dropIndex('org_invite_link', 'org_id', { name: 'org_invite_link_org_id_idx' });
	pgm.dropTable('org_invite_link');
}
