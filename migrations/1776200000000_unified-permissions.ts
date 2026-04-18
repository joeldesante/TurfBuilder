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

/**
 * Replaces the role-based org permission system (org_role / org_role_permission / org_user_role)
 * with a unified LuckPerms-style permission system supporting:
 *   - registered_permission: catalog of all valid permissions (prevents typos)
 *   - permission_group: named bundles of permissions (org or infra scoped, weight-ordered)
 *   - permission_group_entry: permissions belonging to a group (grant or explicit deny)
 *   - user_group_membership: assigns users to groups
 *   - user_permission: direct per-user overrides (always win over group permissions)
 *
 * Existing org_role data is migrated:
 *   - org_role → permission_group (UUIDs reused; owners get weight=0, others 100/200/...)
 *   - org_role_permission → permission_group_entry (via registered_permission lookup)
 *   - org_user_role → user_group_membership
 *   - Administrator groups (weight=0) receive all organization permissions explicitly,
 *     replacing the former is_owner bypass.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
	// -------------------------------------------------------------------------
	// 1. ENUM type shared by registered_permission.scope and permission_group.scope
	// -------------------------------------------------------------------------
	pgm.sql(`DROP TYPE IF EXISTS perm_scope CASCADE`);
	pgm.sql(`CREATE TYPE perm_scope AS ENUM ('organization', 'infrastructure')`);

	// -------------------------------------------------------------------------
	// 2. registered_permission — catalog of all valid permissions
	// -------------------------------------------------------------------------
	pgm.createTable('registered_permission', {
		id: 'id',
		key: { type: 'text', notNull: true },
		name: { type: 'text', notNull: true },
		description: { type: 'text', notNull: true },
		scope: { type: 'perm_scope', notNull: true },
		created_at: 'time_stamp'
	});

	pgm.createConstraint(
		'registered_permission',
		'registered_permission_scope_key_unique',
		{
			unique: ['scope', 'key']
		}
	);

	pgm.sql(`ALTER TABLE registered_permission ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY public_read_permissions ON registered_permission
		FOR SELECT USING (true)
	`);

	// -------------------------------------------------------------------------
	// 3. permission_group — replaces org_role
	// -------------------------------------------------------------------------
	pgm.createTable('permission_group', {
		id: 'id',
		name: { type: 'text', notNull: true },
		weight: { type: 'integer', notNull: true, default: 100 },
		scope: { type: 'perm_scope', notNull: true },
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		},
		is_default: { type: 'boolean', notNull: true, default: false },
		created_at: 'time_stamp'
	});

	// Organization-scoped groups must have an organization_id
	pgm.addConstraint(
		'permission_group',
		'permission_group_org_id_check',
		`CHECK (scope = 'infrastructure' OR organization_id IS NOT NULL)`
	);

	// Weight must be unique within each org (for org-scoped groups)
	pgm.sql(`
		CREATE UNIQUE INDEX permission_group_org_weight_unique
		ON permission_group (organization_id, weight)
		WHERE scope = 'organization'
	`);

	// Weight must be unique across all infrastructure groups
	pgm.sql(`
		CREATE UNIQUE INDEX permission_group_infra_weight_unique
		ON permission_group (weight)
		WHERE scope = 'infrastructure'
	`);

	pgm.createIndex('permission_group', ['organization_id'], { name: 'perm_group_org_id_idx' });

	// -------------------------------------------------------------------------
	// 4. permission_group_entry — permissions belonging to a group
	// -------------------------------------------------------------------------
	pgm.createTable('permission_group_entry', {
		id: 'id',
		group_id: {
			type: 'uuid',
			notNull: true,
			references: 'permission_group(id)',
			onDelete: 'CASCADE'
		},
		registered_permission_id: {
			type: 'uuid',
			notNull: true,
			references: 'registered_permission(id)',
			onDelete: 'CASCADE'
		},
		// true = grant, false = explicit deny
		value: { type: 'boolean', notNull: true, default: true }
	});
	pgm.addConstraint(
		'permission_group_entry',
		'pge_group_perm_unique',
		'UNIQUE (group_id, registered_permission_id)'
	);

	// -------------------------------------------------------------------------
	// 5. user_group_membership — assigns users to groups
	// -------------------------------------------------------------------------
	pgm.createTable('user_group_membership', {
		id: 'id',
		user_id: {
			type: 'uuid',
			notNull: true,
			references: '"auth"."user"(id)',
			onDelete: 'CASCADE'
		},
		member_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."member"(id)',
			onDelete: 'CASCADE'
		},
		group_id: {
			type: 'uuid',
			notNull: true,
			references: 'permission_group(id)',
			onDelete: 'CASCADE'
		},
		granted_by: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."user"(id)',
			onDelete: 'SET NULL'
		},
		created_at: 'time_stamp'
	});
	// member_id must be set for org-scoped groups, null for infrastructure groups
	pgm.sql(`
		CREATE OR REPLACE FUNCTION ugm_member_scope_check() RETURNS trigger AS $$
		DECLARE
			grp_scope perm_scope;
			member_user_id uuid;
		BEGIN
			SELECT scope INTO grp_scope FROM public.permission_group WHERE id = NEW.group_id;
			IF grp_scope = 'organization' AND NEW.member_id IS NULL THEN
				RAISE EXCEPTION 'member_id is required for org-scoped group memberships';
			END IF;
			IF grp_scope = 'infrastructure' AND NEW.member_id IS NOT NULL THEN
				RAISE EXCEPTION 'member_id must be null for infrastructure group memberships';
			END IF;
			IF NEW.member_id IS NOT NULL THEN
				SELECT user_id INTO member_user_id FROM "auth"."member" WHERE id = NEW.member_id;
				IF member_user_id != NEW.user_id THEN
					RAISE EXCEPTION 'member_id does not belong to user_id';
				END IF;
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`);
	pgm.sql(`
		CREATE TRIGGER ugm_member_scope_check
		BEFORE INSERT OR UPDATE ON user_group_membership
		FOR EACH ROW EXECUTE FUNCTION ugm_member_scope_check()
	`);
	pgm.addConstraint('user_group_membership', 'ugm_user_group_unique', 'UNIQUE (user_id, group_id)');
	pgm.createIndex('user_group_membership', ['user_id'], { name: 'ugm_user_id_idx' });
	pgm.createIndex('user_group_membership', ['member_id'], { name: 'ugm_member_id_idx' });
	pgm.createIndex('user_group_membership', ['group_id'], { name: 'ugm_group_id_idx' });

	// -------------------------------------------------------------------------
	// 6. user_permission — direct per-user overrides (always win over groups)
	// -------------------------------------------------------------------------
	pgm.createTable('user_permission', {
		id: 'id',
		user_id: {
			type: 'uuid',
			notNull: true,
			references: '"auth"."user"(id)',
			onDelete: 'CASCADE'
		},
		member_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."member"(id)',
			onDelete: 'CASCADE'
		},
		registered_permission_id: {
			type: 'uuid',
			notNull: true,
			references: 'registered_permission(id)',
			onDelete: 'CASCADE'
		},
		// null for infrastructure permissions; set for organization permissions
		organization_id: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		},
		value: { type: 'boolean', notNull: true, default: true },
		granted_by: {
			type: 'uuid',
			notNull: false,
			references: '"auth"."user"(id)',
			onDelete: 'SET NULL'
		},
		created_at: 'time_stamp'
	});

	// member_id required for org-scoped permissions; must be null for infrastructure permissions
	pgm.addConstraint(
		'user_permission',
		'up_member_scope_check',
		`CHECK (
			(organization_id IS NOT NULL AND member_id IS NOT NULL)
			OR
			(organization_id IS NULL AND member_id IS NULL)
		)`
	);
	pgm.sql(`
		CREATE OR REPLACE FUNCTION up_member_user_check() RETURNS trigger AS $$
		DECLARE
			member_user_id uuid;
		BEGIN
			IF NEW.member_id IS NOT NULL THEN
				SELECT user_id INTO member_user_id FROM "auth"."member" WHERE id = NEW.member_id;
				IF member_user_id != NEW.user_id THEN
					RAISE EXCEPTION 'member_id does not belong to user_id';
				END IF;
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`);
	pgm.sql(`
		CREATE TRIGGER up_member_user_check
		BEFORE INSERT OR UPDATE ON user_permission
		FOR EACH ROW EXECUTE FUNCTION up_member_user_check()
	`);

	// Two partial unique indexes handle the nullable organization_id correctly
	pgm.sql(`
		CREATE UNIQUE INDEX user_permission_org_unique
		ON user_permission (member_id, registered_permission_id)
		WHERE member_id IS NOT NULL
	`);
	pgm.sql(`
		CREATE UNIQUE INDEX user_permission_infra_unique
		ON user_permission (user_id, registered_permission_id)
		WHERE user_id IS NOT NULL
	`);
	pgm.createIndex('user_permission', ['member_id'], { name: 'user_permission_member_id_idx' });
	pgm.createIndex('user_permission', ['user_id'], { name: 'user_permission_user_id_idx' });

	// -------------------------------------------------------------------------
	// 7. Seed registered_permission with all known permissions
	// -------------------------------------------------------------------------
	pgm.sql(`
		INSERT INTO registered_permission (key, name, description, scope) VALUES
		('system.access',    'Staff Dashboard Access', 'Grants access to the staff dashboard (/s/). Required to manage the organization.',                                   'organization'),
		('canvass.use',      'Use Canvassing',        'Allows entering turf codes and using the canvassing app to collect responses in the field.',                              'organization'),
		('turf.read',        'View Turfs',            'Grants access to the Turfs page to see the full list of canvassing areas and their assignments.',                        'organization'),
		('turf.create',      'Cut New Turfs',         'Allows drawing and defining new turf boundaries using the map tool.',                                                    'organization'),
		('turf.update',      'Edit Turfs',            'Allows renaming and modifying the boundaries of turfs that have already been created.',                                  'organization'),
		('turf.delete',      'Delete Turfs',          'Allows permanently removing turfs from the organization.',                                                               'organization'),
		('survey.read',      'View Surveys',          'Grants access to the Surveys page to browse all survey templates.',                                                      'organization'),
		('survey.create',    'Create Surveys',        'Allows building new survey templates for canvassers to use in the field.',                                               'organization'),
		('survey.update',    'Edit Surveys',          'Allows modifying the questions, answers, and settings of existing surveys.',                                             'organization'),
		('survey.delete',    'Delete Surveys',        'Allows permanently removing surveys and all of their associated questions.',                                              'organization'),
		('response.read',    'View Responses',        'Grants access to the Responses page to see all data collected in the field.',                                            'organization'),
		('response.delete',  'Delete Responses',      'Allows permanently removing individual canvassing responses from the organization.',                                     'organization'),
		('member.read',      'View Members',          'Grants access to the Members page to see who belongs to the organization.',                                              'organization'),
		('member.update',    'Manage Member Roles',   'Allows changing the role assigned to any member within the organization.',                                               'organization'),
		('member.delete',    'Remove Members',        'Allows kicking members out of the organization entirely.',                                                               'organization'),
		('plugin.manage',    'Manage Plugins',        'Allows enabling and disabling plugins and changing their configuration for this organization.',                          'organization'),
		('access',                  'Infrastructure Access',     'Grants access to the /infra infrastructure management panel.',                                                'infrastructure'),
		('locations.overture_sync', 'Trigger Overture Sync',    'Allows triggering an Overture Maps data sync to update the global location pool.',                           'infrastructure'),
		('users.manage',            'Manage Infra Users',        'Allows granting and revoking infrastructure permissions for other users.',                                   'infrastructure')
	`);

	// -------------------------------------------------------------------------
	// 8. RLS on permission_group
	//    Two-tier: org groups visible only within their org;
	//              infra groups (organization_id IS NULL) visible to all.
	// -------------------------------------------------------------------------
	pgm.sql(`ALTER TABLE permission_group ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE permission_group FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON permission_group
		USING (
			organization_id IS NULL
			OR organization_id = current_setting('app.current_org_id', true)::uuid
		)
		WITH CHECK (
			organization_id IS NULL
			OR organization_id = current_setting('app.current_org_id', true)::uuid
		)
	`);

	// -------------------------------------------------------------------------
	// 9. RLS on permission_group_entry
	//    Visible when the owning group is visible (inherits permission_group's org scope).
	// -------------------------------------------------------------------------
	pgm.sql(`ALTER TABLE permission_group_entry ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE permission_group_entry FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON permission_group_entry
		USING (
			group_id IN (
				SELECT id FROM permission_group
				WHERE organization_id IS NULL
				   OR organization_id = current_setting('app.current_org_id', true)::uuid
			)
		)
	`);

	// -------------------------------------------------------------------------
	// 10. RLS on user_group_membership
	//     Visible when the referenced group is visible.
	// -------------------------------------------------------------------------
	pgm.sql(`ALTER TABLE user_group_membership ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE user_group_membership FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON user_group_membership
		USING (
			group_id IN (
				SELECT id FROM permission_group
				WHERE organization_id IS NULL
				   OR organization_id = current_setting('app.current_org_id', true)::uuid
			)
		)
	`);

	// -------------------------------------------------------------------------
	// 11. RLS on user_permission
	//     Org-scoped rows visible only within their org; infra rows (org IS NULL) visible to all.
	// -------------------------------------------------------------------------
	pgm.sql(`ALTER TABLE user_permission ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE user_permission FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON user_permission
		USING (
			organization_id IS NULL
			OR organization_id = current_setting('app.current_org_id', true)::uuid
		)
		WITH CHECK (
			organization_id IS NULL
			OR organization_id = current_setting('app.current_org_id', true)::uuid
		)
	`);

	// -------------------------------------------------------------------------
	// 12. Migrate org_role → permission_group (reuse existing UUIDs)
	// -------------------------------------------------------------------------

	// Owner roles → weight 0
	pgm.sql(`
		INSERT INTO permission_group (id, name, weight, scope, organization_id, is_default, created_at)
		SELECT id, name, 0, 'organization', org_id, false, created_at
		FROM org_role
		WHERE is_owner = true
	`);

	// Non-owner roles → sequential weights (100, 200, ...) within each org
	pgm.sql(`
		INSERT INTO permission_group (id, name, weight, scope, organization_id, is_default, created_at)
		SELECT
			id,
			name,
			ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at, id) * 100 AS weight,
			'organization',
			org_id,
			is_default,
			created_at
		FROM org_role
		WHERE is_owner = false
	`);

	// -------------------------------------------------------------------------
	// 13. Grant all organization permissions to weight-0 (Administrator) groups
	//     The former is_owner bypass meant no explicit entries existed — now they must be explicit.
	// -------------------------------------------------------------------------
	pgm.sql(`
		INSERT INTO permission_group_entry (group_id, registered_permission_id, value)
		SELECT pg.id, rp.id, true
		FROM permission_group pg
		CROSS JOIN registered_permission rp
		WHERE pg.weight = 0
		  AND pg.scope = 'organization'
		  AND rp.scope = 'organization'
	`);

	// -------------------------------------------------------------------------
	// 14. Migrate org_role_permission → permission_group_entry (non-owner roles only)
	//     Maps old 'resource:action' to registered_permission key 'resource.action'
	// -------------------------------------------------------------------------
	pgm.sql(`
		INSERT INTO permission_group_entry (group_id, registered_permission_id, value)
		SELECT
			orp.role_id AS group_id,
			rp.id AS registered_permission_id,
			true
		FROM org_role_permission orp
		JOIN registered_permission rp ON rp.key = orp.resource || '.' || orp.action
		-- Skip owner roles — already handled above
		WHERE NOT EXISTS (
			SELECT 1 FROM permission_group pg WHERE pg.id = orp.role_id AND pg.weight = 0
		)
		ON CONFLICT (group_id, registered_permission_id) DO NOTHING
	`);

	// -------------------------------------------------------------------------
	// 15. Migrate org_user_role → user_group_membership
	// -------------------------------------------------------------------------
	pgm.sql(`
		INSERT INTO user_group_membership (user_id, member_id, group_id, granted_by, created_at)
		SELECT our.user_id, m.id, our.role_id, NULL, our.created_at
		FROM org_user_role our
		JOIN "auth"."member" m ON m.user_id = our.user_id AND m.organization_id = our.org_id
	`);

	// -------------------------------------------------------------------------
	// 16. Rename migrated default groups to "Everyone"
	// -------------------------------------------------------------------------
	pgm.sql(`
		UPDATE permission_group
		SET name = 'Everyone'
		WHERE is_default = true AND scope = 'organization'
	`);

	// -------------------------------------------------------------------------
	// 17. Ensure all Everyone groups have canvass.use
	// -------------------------------------------------------------------------
	pgm.sql(`
		INSERT INTO permission_group_entry (group_id, registered_permission_id, value)
		SELECT pg.id, rp.id, true
		FROM permission_group pg
		CROSS JOIN registered_permission rp
		WHERE pg.is_default = true
		  AND pg.scope = 'organization'
		  AND rp.key = 'canvass.use'
		ON CONFLICT (group_id, registered_permission_id) DO NOTHING
	`);

	// -------------------------------------------------------------------------
	// 18. Drop old tables (remove RLS policies first)
	// -------------------------------------------------------------------------
	pgm.sql(`DROP POLICY IF EXISTS org_isolation ON org_role`);
	pgm.sql(`ALTER TABLE org_role DISABLE ROW LEVEL SECURITY`);
	pgm.sql(`DROP POLICY IF EXISTS org_isolation ON org_user_role`);
	pgm.sql(`ALTER TABLE org_user_role DISABLE ROW LEVEL SECURITY`);

	pgm.dropTable('org_role_permission');
	pgm.dropTable('org_user_role');
	pgm.dropTable('org_role');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	// Recreate old tables
	pgm.createTable('org_role', {
		id: 'id',
		org_id: {
			type: 'uuid',
			notNull: true,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		},
		name: { type: 'text', notNull: true },
		is_owner: { type: 'boolean', notNull: true, default: false },
		is_default: { type: 'boolean', notNull: true, default: false },
		created_at: 'time_stamp'
	});

	pgm.createTable('org_role_permission', {
		id: 'id',
		role_id: {
			type: 'uuid',
			notNull: true,
			references: 'org_role(id)',
			onDelete: 'CASCADE'
		},
		resource: { type: 'text', notNull: true },
		action: { type: 'text', notNull: true }
	});

	pgm.createTable('org_user_role', {
		id: 'id',
		org_id: {
			type: 'uuid',
			notNull: true,
			references: '"auth"."organization"(id)',
			onDelete: 'CASCADE'
		},
		user_id: {
			type: 'uuid',
			notNull: true,
			references: '"auth"."user"(id)',
			onDelete: 'CASCADE'
		},
		role_id: {
			type: 'uuid',
			notNull: true,
			references: 'org_role(id)',
			onDelete: 'CASCADE'
		},
		created_at: 'time_stamp'
	});
	pgm.addConstraint('org_user_role', 'org_user_role_unique', 'UNIQUE (org_id, user_id)');

	// Re-enable RLS
	pgm.sql(`ALTER TABLE org_role ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE org_role FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON org_role
		USING (org_id = current_setting('app.current_org_id', true)::uuid)
		WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
	`);
	pgm.sql(`ALTER TABLE org_user_role ENABLE ROW LEVEL SECURITY`);
	pgm.sql(`ALTER TABLE org_user_role FORCE ROW LEVEL SECURITY`);
	pgm.sql(`
		CREATE POLICY org_isolation ON org_user_role
		USING (org_id = current_setting('app.current_org_id', true)::uuid)
		WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid)
	`);

	// Drop new tables in reverse dependency order
	pgm.sql(`DROP TRIGGER IF EXISTS up_member_user_check ON user_permission`);
	pgm.sql(`DROP FUNCTION IF EXISTS up_member_user_check()`);
	pgm.dropTable('user_permission');
	pgm.sql(`DROP TRIGGER IF EXISTS ugm_member_scope_check ON user_group_membership`);
	pgm.sql(`DROP FUNCTION IF EXISTS ugm_member_scope_check()`);
	pgm.dropTable('user_group_membership');
	pgm.dropTable('permission_group_entry');
	pgm.dropTable('permission_group');
	pgm.dropTable('registered_permission');
	pgm.sql(`DROP TYPE perm_scope`);
}
