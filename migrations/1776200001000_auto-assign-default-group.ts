import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	// -------------------------------------------------------------------------
	// 1. Guard the Everyone group — prevent deletion, toggling is_default,
	//    and creating a second default group in the same org.
	// -------------------------------------------------------------------------
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

	// -------------------------------------------------------------------------
	// 2. Auto-assign new members to the org's Everyone group on join.
	// -------------------------------------------------------------------------
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

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`DROP TRIGGER IF EXISTS assign_default_permission_group ON "auth"."member"`);
	pgm.sql(`DROP FUNCTION IF EXISTS assign_default_permission_group()`);
	pgm.sql(`DROP TRIGGER IF EXISTS permission_group_everyone_guard ON permission_group`);
	pgm.sql(`DROP FUNCTION IF EXISTS permission_group_everyone_guard()`);
}
