import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	// Drop triggers/functions whose bodies reference old table/column names before renaming.
	pgm.sql(`DROP TRIGGER IF EXISTS ugm_member_scope_check ON user_group_membership`);
	pgm.sql(`DROP FUNCTION IF EXISTS ugm_member_scope_check()`);
	pgm.sql(`DROP TRIGGER IF EXISTS permission_group_everyone_guard ON permission_group`);
	pgm.sql(`DROP FUNCTION IF EXISTS permission_group_everyone_guard()`);
	pgm.sql(`DROP TRIGGER IF EXISTS assign_default_permission_group ON "auth"."member"`);
	pgm.sql(`DROP FUNCTION IF EXISTS assign_default_permission_group()`);

	// Rename tables.
	pgm.sql(`ALTER TABLE permission_group RENAME TO permission_role`);
	pgm.sql(`ALTER TABLE permission_group_entry RENAME TO permission_role_entry`);
	pgm.sql(`ALTER TABLE user_group_membership RENAME TO user_role_membership`);

	// Rename group_id columns.
	pgm.sql(`ALTER TABLE permission_role_entry RENAME COLUMN group_id TO role_id`);
	pgm.sql(`ALTER TABLE user_role_membership RENAME COLUMN group_id TO role_id`);

	// Rename constraints that embed the old column name so they stay meaningful.
	pgm.sql(`ALTER TABLE permission_role_entry RENAME CONSTRAINT pge_group_perm_unique TO pre_role_perm_unique`);
	pgm.sql(`ALTER TABLE user_role_membership RENAME CONSTRAINT ugm_user_group_unique TO urm_user_role_unique`);
	pgm.sql(`ALTER TABLE permission_role RENAME CONSTRAINT permission_group_org_id_check TO permission_role_org_id_check`);

	// Rename indexes.
	pgm.sql(`ALTER INDEX IF EXISTS perm_group_org_id_idx RENAME TO perm_role_org_id_idx`);
	pgm.sql(`ALTER INDEX IF EXISTS ugm_group_id_idx RENAME TO urm_role_id_idx`);
	pgm.sql(`ALTER INDEX IF EXISTS permission_group_org_weight_unique RENAME TO permission_role_org_weight_unique`);
	pgm.sql(`ALTER INDEX IF EXISTS permission_group_infra_weight_unique RENAME TO permission_role_infra_weight_unique`);

	// Recreate scope-check trigger on user_role_membership.
	pgm.sql(`
		CREATE OR REPLACE FUNCTION urm_member_scope_check() RETURNS trigger AS $$
		DECLARE
			role_scope perm_scope;
			member_user_id uuid;
		BEGIN
			SELECT scope INTO role_scope FROM public.permission_role WHERE id = NEW.role_id;
			IF role_scope = 'organization' AND NEW.member_id IS NULL THEN
				RAISE EXCEPTION 'member_id is required for org-scoped role memberships';
			END IF;
			IF role_scope = 'infrastructure' AND NEW.member_id IS NOT NULL THEN
				RAISE EXCEPTION 'member_id must be null for infrastructure role memberships';
			END IF;
			IF NEW.member_id IS NOT NULL THEN
				SELECT user_id INTO member_user_id FROM "auth"."member" WHERE id = NEW.member_id;
				IF member_user_id != NEW.user_id THEN
					RAISE EXCEPTION 'member_id does not belong to user_id';
				END IF;
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`);
	pgm.sql(`
		CREATE TRIGGER urm_member_scope_check
		BEFORE INSERT OR UPDATE ON user_role_membership
		FOR EACH ROW EXECUTE FUNCTION urm_member_scope_check()
	`);

	// Recreate Everyone guard on permission_role.
	pgm.sql(`
		CREATE OR REPLACE FUNCTION permission_role_guard() RETURNS trigger AS $$
		DECLARE
			existing_default uuid;
		BEGIN
			IF TG_OP = 'DELETE' THEN
				IF OLD.is_default = true THEN
					RAISE EXCEPTION 'Cannot delete the Everyone role';
				END IF;
				RETURN OLD;
			END IF;

			IF TG_OP = 'UPDATE' AND OLD.is_default IS DISTINCT FROM NEW.is_default THEN
				RAISE EXCEPTION 'Cannot change is_default on a permission role';
			END IF;

			IF TG_OP = 'INSERT' AND NEW.is_default = true THEN
				SELECT id INTO existing_default
				FROM public.permission_role
				WHERE organization_id = NEW.organization_id AND is_default = true;
				IF existing_default IS NOT NULL THEN
					RAISE EXCEPTION 'An org can only have one default permission role (Everyone)';
				END IF;
			END IF;

			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`);
	pgm.sql(`
		CREATE TRIGGER permission_role_guard
		BEFORE INSERT OR UPDATE OR DELETE ON permission_role
		FOR EACH ROW EXECUTE FUNCTION permission_role_guard()
	`);

	// Recreate auto-assign trigger on auth.member.
	pgm.sql(`
		CREATE OR REPLACE FUNCTION assign_default_permission_role() RETURNS trigger AS $$
		DECLARE
			default_role_id uuid;
		BEGIN
			SELECT id INTO default_role_id
			FROM public.permission_role
			WHERE organization_id = NEW.organization_id
			  AND is_default = true
			  AND scope = 'organization'
			LIMIT 1;

			IF default_role_id IS NOT NULL THEN
				INSERT INTO public.user_role_membership (user_id, member_id, role_id)
				VALUES (NEW.user_id, NEW.id, default_role_id)
				ON CONFLICT DO NOTHING;
			END IF;

			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`);
	pgm.sql(`
		CREATE TRIGGER assign_default_permission_role
		AFTER INSERT ON "auth"."member"
		FOR EACH ROW EXECUTE FUNCTION assign_default_permission_role()
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`DROP TRIGGER IF EXISTS assign_default_permission_role ON "auth"."member"`);
	pgm.sql(`DROP FUNCTION IF EXISTS assign_default_permission_role()`);
	pgm.sql(`DROP TRIGGER IF EXISTS permission_role_guard ON permission_role`);
	pgm.sql(`DROP FUNCTION IF EXISTS permission_role_guard()`);
	pgm.sql(`DROP TRIGGER IF EXISTS urm_member_scope_check ON user_role_membership`);
	pgm.sql(`DROP FUNCTION IF EXISTS urm_member_scope_check()`);

	pgm.sql(`ALTER INDEX IF EXISTS permission_role_infra_weight_unique RENAME TO permission_group_infra_weight_unique`);
	pgm.sql(`ALTER INDEX IF EXISTS permission_role_org_weight_unique RENAME TO permission_group_org_weight_unique`);
	pgm.sql(`ALTER INDEX IF EXISTS urm_role_id_idx RENAME TO ugm_group_id_idx`);
	pgm.sql(`ALTER INDEX IF EXISTS perm_role_org_id_idx RENAME TO perm_group_org_id_idx`);

	pgm.sql(`ALTER TABLE permission_role RENAME CONSTRAINT permission_role_org_id_check TO permission_group_org_id_check`);
	pgm.sql(`ALTER TABLE user_role_membership RENAME CONSTRAINT urm_user_role_unique TO ugm_user_group_unique`);
	pgm.sql(`ALTER TABLE permission_role_entry RENAME CONSTRAINT pre_role_perm_unique TO pge_group_perm_unique`);

	pgm.sql(`ALTER TABLE user_role_membership RENAME COLUMN role_id TO group_id`);
	pgm.sql(`ALTER TABLE permission_role_entry RENAME COLUMN role_id TO group_id`);

	pgm.sql(`ALTER TABLE user_role_membership RENAME TO user_group_membership`);
	pgm.sql(`ALTER TABLE permission_role_entry RENAME TO permission_group_entry`);
	pgm.sql(`ALTER TABLE permission_role RENAME TO permission_group`);

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
		$$ LANGUAGE plpgsql
	`);
	pgm.sql(`
		CREATE TRIGGER ugm_member_scope_check
		BEFORE INSERT OR UPDATE ON user_group_membership
		FOR EACH ROW EXECUTE FUNCTION ugm_member_scope_check()
	`);

	pgm.sql(`
		CREATE OR REPLACE FUNCTION permission_group_everyone_guard() RETURNS trigger AS $$
		DECLARE
			existing_default uuid;
		BEGIN
			IF TG_OP = 'DELETE' THEN
				IF OLD.is_default = true THEN
					RAISE EXCEPTION 'Cannot delete the Everyone group';
				END IF;
				RETURN OLD;
			END IF;

			IF TG_OP = 'UPDATE' AND OLD.is_default IS DISTINCT FROM NEW.is_default THEN
				RAISE EXCEPTION 'Cannot change is_default on a permission group';
			END IF;

			IF TG_OP = 'INSERT' AND NEW.is_default = true THEN
				SELECT id INTO existing_default
				FROM public.permission_group
				WHERE organization_id = NEW.organization_id AND is_default = true;
				IF existing_default IS NOT NULL THEN
					RAISE EXCEPTION 'An org can only have one default permission group (Everyone)';
				END IF;
			END IF;

			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`);
	pgm.sql(`
		CREATE TRIGGER permission_group_everyone_guard
		BEFORE INSERT OR UPDATE OR DELETE ON permission_group
		FOR EACH ROW EXECUTE FUNCTION permission_group_everyone_guard()
	`);

	pgm.sql(`
		CREATE OR REPLACE FUNCTION assign_default_permission_group() RETURNS trigger AS $$
		DECLARE
			default_group_id uuid;
		BEGIN
			SELECT id INTO default_group_id
			FROM public.permission_group
			WHERE organization_id = NEW.organization_id
			  AND is_default = true
			  AND scope = 'organization'
			LIMIT 1;

			IF default_group_id IS NOT NULL THEN
				INSERT INTO public.user_group_membership (user_id, member_id, group_id)
				VALUES (NEW.user_id, NEW.id, default_group_id)
				ON CONFLICT DO NOTHING;
			END IF;

			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`);
	pgm.sql(`
		CREATE TRIGGER assign_default_permission_group
		AFTER INSERT ON "auth"."member"
		FOR EACH ROW EXECUTE FUNCTION assign_default_permission_group()
	`);
}
