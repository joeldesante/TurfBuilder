-- Up Migration
-- Mirrors SETUP_STEPS step 7: "Creating database triggers"
--
-- CREATE TRIGGER has no portable IF NOT EXISTS, so each binding is preceded by
-- DROP TRIGGER IF EXISTS. The functions use CREATE OR REPLACE, which is already
-- idempotent.

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
		SELECT user_id INTO member_user_id FROM auth.member WHERE id = NEW.member_id;
		IF member_user_id != NEW.user_id THEN
			RAISE EXCEPTION 'member_id does not belong to user_id';
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS urm_member_scope_check ON user_role_membership;
CREATE TRIGGER urm_member_scope_check
	BEFORE INSERT OR UPDATE ON user_role_membership
	FOR EACH ROW EXECUTE FUNCTION urm_member_scope_check();

CREATE OR REPLACE FUNCTION up_member_user_check() RETURNS trigger AS $$
DECLARE
	member_user_id uuid;
BEGIN
	IF NEW.member_id IS NOT NULL THEN
		SELECT user_id INTO member_user_id FROM auth.member WHERE id = NEW.member_id;
		IF member_user_id != NEW.user_id THEN
			RAISE EXCEPTION 'member_id does not belong to user_id';
		END IF;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS up_member_user_check ON user_permission;
CREATE TRIGGER up_member_user_check
	BEFORE INSERT OR UPDATE ON user_permission
	FOR EACH ROW EXECUTE FUNCTION up_member_user_check();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permission_role_guard ON permission_role;
CREATE TRIGGER permission_role_guard
	BEFORE INSERT OR UPDATE OR DELETE ON permission_role
	FOR EACH ROW EXECUTE FUNCTION permission_role_guard();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_default_permission_role ON auth.member;
CREATE TRIGGER assign_default_permission_role
	AFTER INSERT ON auth.member
	FOR EACH ROW EXECUTE FUNCTION assign_default_permission_role();

-- Down Migration

DROP TRIGGER IF EXISTS assign_default_permission_role ON auth.member;
DROP TRIGGER IF EXISTS permission_role_guard ON permission_role;
DROP TRIGGER IF EXISTS up_member_user_check ON user_permission;
DROP TRIGGER IF EXISTS urm_member_scope_check ON user_role_membership;
DROP FUNCTION IF EXISTS assign_default_permission_role() CASCADE;
DROP FUNCTION IF EXISTS permission_role_guard() CASCADE;
DROP FUNCTION IF EXISTS up_member_user_check() CASCADE;
DROP FUNCTION IF EXISTS urm_member_scope_check() CASCADE;
