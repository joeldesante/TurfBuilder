-- Up Migration
-- Mirrors SETUP_STEPS step 23: "Creating universe indexes"
--
-- The *_entity_current_idx partial indexes back the valid_to IS NULL lookups
-- that resolve an entity to its live version. The GIN indexes back free-text
-- search; the GIST indexes back map viewport queries.

-- public_entity
CREATE INDEX IF NOT EXISTS public_entity_type_id_idx    ON universe.public_entity (type_id);
CREATE INDEX IF NOT EXISTS public_entity_source_ref_idx ON universe.public_entity (source_ref);

-- org_entity
CREATE INDEX IF NOT EXISTS org_entity_org_id_idx     ON universe.org_entity (org_id);
CREATE INDEX IF NOT EXISTS org_entity_type_id_idx    ON universe.org_entity (type_id);
CREATE INDEX IF NOT EXISTS org_entity_source_ref_idx ON universe.org_entity (source_ref);

-- public_person
CREATE INDEX IF NOT EXISTS public_person_entity_id_idx         ON universe.public_person (entity_id);
CREATE INDEX IF NOT EXISTS public_person_entity_current_idx     ON universe.public_person (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS public_person_name_idx               ON universe.public_person (last_name, first_name);
CREATE INDEX IF NOT EXISTS public_person_fts_idx                ON universe.public_person USING GIN (
	to_tsvector('simple',
		COALESCE(first_name, '') || ' ' ||
		COALESCE(middle_name, '') || ' ' ||
		COALESCE(last_name, '') || ' ' ||
		COALESCE(preferred_name, '')
	)
);

-- public_organization
CREATE INDEX IF NOT EXISTS public_organization_entity_id_idx     ON universe.public_organization (entity_id);
CREATE INDEX IF NOT EXISTS public_organization_entity_current_idx ON universe.public_organization (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS public_organization_name_idx           ON universe.public_organization (name);
CREATE INDEX IF NOT EXISTS public_organization_fts_idx            ON universe.public_organization USING GIN (to_tsvector('simple', name));

-- public_location
CREATE INDEX IF NOT EXISTS public_location_entity_id_idx      ON universe.public_location (entity_id);
CREATE INDEX IF NOT EXISTS public_location_entity_current_idx  ON universe.public_location (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS public_location_coordinates_idx     ON universe.public_location USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS public_location_city_idx            ON universe.public_location (city);
CREATE INDEX IF NOT EXISTS public_location_postal_code_idx     ON universe.public_location (postal_code);
CREATE INDEX IF NOT EXISTS public_location_fts_idx             ON universe.public_location USING GIN (
	to_tsvector('simple',
		COALESCE(name, '') || ' ' ||
		COALESCE(address_line_1, '') || ' ' ||
		COALESCE(city, '') || ' ' ||
		COALESCE(postal_code, '')
	)
);

-- org_person
CREATE INDEX IF NOT EXISTS org_person_org_id_idx          ON universe.org_person (org_id);
CREATE INDEX IF NOT EXISTS org_person_entity_id_idx        ON universe.org_person (entity_id);
CREATE INDEX IF NOT EXISTS org_person_entity_current_idx   ON universe.org_person (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS org_person_name_idx             ON universe.org_person (org_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS org_person_fts_idx              ON universe.org_person USING GIN (
	to_tsvector('simple',
		COALESCE(first_name, '') || ' ' ||
		COALESCE(middle_name, '') || ' ' ||
		COALESCE(last_name, '') || ' ' ||
		COALESCE(preferred_name, '')
	)
);

-- org_organization
CREATE INDEX IF NOT EXISTS org_organization_org_id_idx          ON universe.org_organization (org_id);
CREATE INDEX IF NOT EXISTS org_organization_entity_id_idx        ON universe.org_organization (entity_id);
CREATE INDEX IF NOT EXISTS org_organization_entity_current_idx   ON universe.org_organization (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS org_organization_name_idx             ON universe.org_organization (org_id, name);
CREATE INDEX IF NOT EXISTS org_organization_fts_idx              ON universe.org_organization USING GIN (to_tsvector('simple', name));

-- org_location
CREATE INDEX IF NOT EXISTS org_location_org_id_idx          ON universe.org_location (org_id);
CREATE INDEX IF NOT EXISTS org_location_entity_id_idx        ON universe.org_location (entity_id);
CREATE INDEX IF NOT EXISTS org_location_entity_current_idx   ON universe.org_location (entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS org_location_coordinates_idx      ON universe.org_location USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS org_location_city_idx             ON universe.org_location (org_id, city);
CREATE INDEX IF NOT EXISTS org_location_postal_code_idx      ON universe.org_location (org_id, postal_code);
CREATE INDEX IF NOT EXISTS org_location_fts_idx              ON universe.org_location USING GIN (
	to_tsvector('simple',
		COALESCE(name, '') || ' ' ||
		COALESCE(address_line_1, '') || ' ' ||
		COALESCE(city, '') || ' ' ||
		COALESCE(postal_code, '')
	)
);

-- public_relationship
CREATE INDEX IF NOT EXISTS public_rel_from_idx         ON universe.public_relationship (from_entity_id);
CREATE INDEX IF NOT EXISTS public_rel_to_idx           ON universe.public_relationship (to_entity_id);
CREATE INDEX IF NOT EXISTS public_rel_from_active_idx  ON universe.public_relationship (from_entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS public_rel_to_active_idx    ON universe.public_relationship (to_entity_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS public_rel_type_idx         ON universe.public_relationship (relationship_type_id);

-- org_relationship
CREATE INDEX IF NOT EXISTS org_rel_org_id_idx              ON universe.org_relationship (org_id);
CREATE INDEX IF NOT EXISTS org_rel_from_public_idx         ON universe.org_relationship (from_public_entity_id) WHERE from_public_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_rel_from_org_idx            ON universe.org_relationship (from_org_entity_id) WHERE from_org_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_rel_to_public_idx           ON universe.org_relationship (to_public_entity_id) WHERE to_public_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_rel_to_org_idx              ON universe.org_relationship (to_org_entity_id) WHERE to_org_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_rel_type_active_idx         ON universe.org_relationship (org_id, relationship_type_id) WHERE valid_to IS NULL;

-- tag
CREATE INDEX IF NOT EXISTS tag_org_id_idx ON universe.tag (org_id);

-- entity_tag
CREATE INDEX IF NOT EXISTS entity_tag_org_id_idx        ON universe.entity_tag (org_id);
CREATE INDEX IF NOT EXISTS entity_tag_tag_id_idx         ON universe.entity_tag (tag_id);
CREATE INDEX IF NOT EXISTS entity_tag_public_entity_idx  ON universe.entity_tag (public_entity_id) WHERE public_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS entity_tag_org_entity_idx     ON universe.entity_tag (org_entity_id) WHERE org_entity_id IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS universe.entity_tag_org_entity_idx;
DROP INDEX IF EXISTS universe.entity_tag_public_entity_idx;
DROP INDEX IF EXISTS universe.entity_tag_tag_id_idx;
DROP INDEX IF EXISTS universe.entity_tag_org_id_idx;
DROP INDEX IF EXISTS universe.tag_org_id_idx;
DROP INDEX IF EXISTS universe.org_rel_type_active_idx;
DROP INDEX IF EXISTS universe.org_rel_to_org_idx;
DROP INDEX IF EXISTS universe.org_rel_to_public_idx;
DROP INDEX IF EXISTS universe.org_rel_from_org_idx;
DROP INDEX IF EXISTS universe.org_rel_from_public_idx;
DROP INDEX IF EXISTS universe.org_rel_org_id_idx;
DROP INDEX IF EXISTS universe.public_rel_type_idx;
DROP INDEX IF EXISTS universe.public_rel_to_active_idx;
DROP INDEX IF EXISTS universe.public_rel_from_active_idx;
DROP INDEX IF EXISTS universe.public_rel_to_idx;
DROP INDEX IF EXISTS universe.public_rel_from_idx;
DROP INDEX IF EXISTS universe.org_location_fts_idx;
DROP INDEX IF EXISTS universe.org_location_postal_code_idx;
DROP INDEX IF EXISTS universe.org_location_city_idx;
DROP INDEX IF EXISTS universe.org_location_coordinates_idx;
DROP INDEX IF EXISTS universe.org_location_entity_current_idx;
DROP INDEX IF EXISTS universe.org_location_entity_id_idx;
DROP INDEX IF EXISTS universe.org_location_org_id_idx;
DROP INDEX IF EXISTS universe.org_organization_fts_idx;
DROP INDEX IF EXISTS universe.org_organization_name_idx;
DROP INDEX IF EXISTS universe.org_organization_entity_current_idx;
DROP INDEX IF EXISTS universe.org_organization_entity_id_idx;
DROP INDEX IF EXISTS universe.org_organization_org_id_idx;
DROP INDEX IF EXISTS universe.org_person_fts_idx;
DROP INDEX IF EXISTS universe.org_person_name_idx;
DROP INDEX IF EXISTS universe.org_person_entity_current_idx;
DROP INDEX IF EXISTS universe.org_person_entity_id_idx;
DROP INDEX IF EXISTS universe.org_person_org_id_idx;
DROP INDEX IF EXISTS universe.public_location_fts_idx;
DROP INDEX IF EXISTS universe.public_location_postal_code_idx;
DROP INDEX IF EXISTS universe.public_location_city_idx;
DROP INDEX IF EXISTS universe.public_location_coordinates_idx;
DROP INDEX IF EXISTS universe.public_location_entity_current_idx;
DROP INDEX IF EXISTS universe.public_location_entity_id_idx;
DROP INDEX IF EXISTS universe.public_organization_fts_idx;
DROP INDEX IF EXISTS universe.public_organization_name_idx;
DROP INDEX IF EXISTS universe.public_organization_entity_current_idx;
DROP INDEX IF EXISTS universe.public_organization_entity_id_idx;
DROP INDEX IF EXISTS universe.public_person_fts_idx;
DROP INDEX IF EXISTS universe.public_person_name_idx;
DROP INDEX IF EXISTS universe.public_person_entity_current_idx;
DROP INDEX IF EXISTS universe.public_person_entity_id_idx;
DROP INDEX IF EXISTS universe.org_entity_source_ref_idx;
DROP INDEX IF EXISTS universe.org_entity_type_id_idx;
DROP INDEX IF EXISTS universe.org_entity_org_id_idx;
DROP INDEX IF EXISTS universe.public_entity_source_ref_idx;
DROP INDEX IF EXISTS universe.public_entity_type_id_idx;
