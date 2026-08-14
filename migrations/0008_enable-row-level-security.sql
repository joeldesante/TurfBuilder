-- Up Migration
-- Mirrors SETUP_STEPS step 8: "Enabling row-level security"
--
-- CREATE POLICY has no IF NOT EXISTS in any PostgreSQL version, so every policy
-- is preceded by DROP POLICY IF EXISTS. ENABLE/FORCE ROW LEVEL SECURITY are
-- already idempotent.
--
-- The org predicate is the same expression withOrgTransaction sets:
--   NULLIF(current_setting('app.current_org_id', true), '')::uuid
-- NULLIF guards the unset case, where current_setting returns '' rather than
-- NULL and a bare cast would raise.

-- plugin_installation: direct organization_id
ALTER TABLE plugin_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_installation FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON plugin_installation;
CREATE POLICY org_isolation ON plugin_installation
	USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- registered_permission: public read
ALTER TABLE registered_permission ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_permissions ON registered_permission;
CREATE POLICY public_read_permissions ON registered_permission FOR SELECT USING (true);

-- permission_role: org rows visible to their org; infra rows visible to all
ALTER TABLE permission_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_role FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON permission_role;
CREATE POLICY org_isolation ON permission_role
	USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- permission_role_entry: visible when its role is visible
ALTER TABLE permission_role_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_role_entry FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON permission_role_entry;
CREATE POLICY org_isolation ON permission_role_entry
	USING (
		role_id IN (
			SELECT id FROM permission_role
			WHERE organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
		)
	);

-- user_role_membership
ALTER TABLE user_role_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_membership FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON user_role_membership;
CREATE POLICY org_isolation ON user_role_membership
	USING (
		role_id IN (
			SELECT id FROM permission_role
			WHERE organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
		)
	);

-- user_permission
ALTER TABLE user_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON user_permission;
CREATE POLICY org_isolation ON user_permission
	USING (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP POLICY IF EXISTS org_isolation ON user_permission;
ALTER TABLE user_permission NO FORCE ROW LEVEL SECURITY;
ALTER TABLE user_permission DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON user_role_membership;
ALTER TABLE user_role_membership NO FORCE ROW LEVEL SECURITY;
ALTER TABLE user_role_membership DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON permission_role_entry;
ALTER TABLE permission_role_entry NO FORCE ROW LEVEL SECURITY;
ALTER TABLE permission_role_entry DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON permission_role;
ALTER TABLE permission_role NO FORCE ROW LEVEL SECURITY;
ALTER TABLE permission_role DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_permissions ON registered_permission;
ALTER TABLE registered_permission DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON plugin_installation;
ALTER TABLE plugin_installation NO FORCE ROW LEVEL SECURITY;
ALTER TABLE plugin_installation DISABLE ROW LEVEL SECURITY;
