-- Up Migration
-- Mirrors SETUP_STEPS step 21: "Enabling universe row-level security"
--
-- The source step builds these with flatMap over three table groups; they are
-- written out here so the file is the literal SQL that runs.
--
--   catalogue + public tables -> readable by every org, SELECT only
--   org-scoped tables         -> isolated to the org in app.current_org_id

-- Catalogue tables: public read
ALTER TABLE universe.entity_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.entity_type;
CREATE POLICY public_read ON universe.entity_type FOR SELECT USING (true);

ALTER TABLE universe.organization_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.organization_type;
CREATE POLICY public_read ON universe.organization_type FOR SELECT USING (true);

ALTER TABLE universe.relationship_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.relationship_type;
CREATE POLICY public_read ON universe.relationship_type FOR SELECT USING (true);

-- Public entity and version tables: visible to all orgs
ALTER TABLE universe.public_entity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.public_entity;
CREATE POLICY public_read ON universe.public_entity FOR SELECT USING (true);

ALTER TABLE universe.public_person ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.public_person;
CREATE POLICY public_read ON universe.public_person FOR SELECT USING (true);

ALTER TABLE universe.public_organization ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.public_organization;
CREATE POLICY public_read ON universe.public_organization FOR SELECT USING (true);

ALTER TABLE universe.public_location ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.public_location;
CREATE POLICY public_read ON universe.public_location FOR SELECT USING (true);

ALTER TABLE universe.public_relationship ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON universe.public_relationship;
CREATE POLICY public_read ON universe.public_relationship FOR SELECT USING (true);

-- Org-scoped tables: isolated to owning org
ALTER TABLE universe.org_entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.org_entity FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.org_entity;
CREATE POLICY org_isolation ON universe.org_entity
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.org_person ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.org_person FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.org_person;
CREATE POLICY org_isolation ON universe.org_person
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.org_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.org_organization FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.org_organization;
CREATE POLICY org_isolation ON universe.org_organization
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.org_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.org_location FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.org_location;
CREATE POLICY org_isolation ON universe.org_location
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.org_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.org_relationship FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.org_relationship;
CREATE POLICY org_isolation ON universe.org_relationship
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.tag FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.tag;
CREATE POLICY org_isolation ON universe.tag
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE universe.entity_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe.entity_tag FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON universe.entity_tag;
CREATE POLICY org_isolation ON universe.entity_tag
	USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
	WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Down Migration

DROP POLICY IF EXISTS org_isolation ON universe.entity_tag;
ALTER TABLE universe.entity_tag NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.entity_tag DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.tag;
ALTER TABLE universe.tag NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.tag DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_relationship;
ALTER TABLE universe.org_relationship NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.org_relationship DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_location;
ALTER TABLE universe.org_location NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.org_location DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_organization;
ALTER TABLE universe.org_organization NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.org_organization DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_person;
ALTER TABLE universe.org_person NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.org_person DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON universe.org_entity;
ALTER TABLE universe.org_entity NO FORCE ROW LEVEL SECURITY;
ALTER TABLE universe.org_entity DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.public_relationship;
ALTER TABLE universe.public_relationship DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.public_location;
ALTER TABLE universe.public_location DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.public_organization;
ALTER TABLE universe.public_organization DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.public_person;
ALTER TABLE universe.public_person DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.public_entity;
ALTER TABLE universe.public_entity DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.relationship_type;
ALTER TABLE universe.relationship_type DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.organization_type;
ALTER TABLE universe.organization_type DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read ON universe.entity_type;
ALTER TABLE universe.entity_type DISABLE ROW LEVEL SECURITY;
