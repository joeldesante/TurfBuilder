import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.createTable('plugin_installation', {
		id: {
			type: 'uuid',
			primaryKey: true,
			notNull: true,
			default: pgm.func('gen_random_uuid()')
		},
		organization_id: {
			type: 'uuid',
			notNull: true,
			references: { schema: 'auth', name: 'organization' },
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		plugin_slug: { type: 'text', notNull: true },
		enabled: { type: 'boolean', notNull: true, default: true },
		config: { type: 'jsonb', notNull: true, default: '{}' },
		installed_by: {
			type: 'uuid',
			references: { schema: 'auth', name: 'user' },
			onDelete: 'SET NULL'
		},
		created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
		updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
	});

	pgm.addConstraint(
		'plugin_installation',
		'plugin_installation_org_slug_unique',
		'UNIQUE (organization_id, plugin_slug)'
	);

	pgm.createIndex('plugin_installation', 'organization_id', {
		name: 'plugin_installation_org_id_idx'
	});
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropIndex('plugin_installation', 'organization_id', {
		name: 'plugin_installation_org_id_idx'
	});
	pgm.dropConstraint('plugin_installation', 'plugin_installation_org_slug_unique');
	pgm.dropTable('plugin_installation');
}
