-- Up Migration
-- The filter editor can filter contacts by their schema and by the values of
-- its fields, so the current-contacts view exposes the schema a contact uses.
-- The column goes last: CREATE OR REPLACE VIEW only allows adding columns at the end.

CREATE OR REPLACE VIEW universe.v_contacts AS
SELECT c.id,
	'org_contact'::text AS source,
	c.entity_id,
	c.type,
	c.metadata,
	NULLIF(c.metadata ->> 'name'::text, ''::text) AS name,
	COALESCE(NULLIF(concat_ws(' '::text, a.premises_number, a.thoroughfare_pre_qualifier, a.thoroughfare_name, a.thoroughfare_type, a.thoroughfare_post_qualifier), ''::text), a.premises_name) AS address_line_1,
	NULLIF(concat_ws(' '::text, a.unit_type, a.unit_identifier), ''::text) AS address_line_2,
	a.locality AS city,
	a.region AS state_or_region,
	a.postcode AS postal_code,
	a.country_code::text AS country_code,
	a.coordinates,
	c.photo_keys,
	a.id AS address_id,
	c.address_entity_id,
	c.schema_id
FROM universe.org_contact c
	JOIN universe.org_address a ON a.entity_id = c.address_entity_id AND a.org_id = c.org_id AND a.valid_to IS NULL
WHERE c.valid_to IS NULL
	AND c.org_id = NULLIF(current_setting('app.current_org_id'::text, true), ''::text)::uuid
	AND NOT (EXISTS (
		SELECT 1
		FROM universe.location_suggestion ls
		WHERE ls.entity_id = c.entity_id AND ls.status = 'tentative'::text
	));

-- Down Migration
-- A view cannot lose a column in place, so it is dropped and made again without it.

DROP VIEW universe.v_contacts;

CREATE VIEW universe.v_contacts AS
SELECT c.id,
	'org_contact'::text AS source,
	c.entity_id,
	c.type,
	c.metadata,
	NULLIF(c.metadata ->> 'name'::text, ''::text) AS name,
	COALESCE(NULLIF(concat_ws(' '::text, a.premises_number, a.thoroughfare_pre_qualifier, a.thoroughfare_name, a.thoroughfare_type, a.thoroughfare_post_qualifier), ''::text), a.premises_name) AS address_line_1,
	NULLIF(concat_ws(' '::text, a.unit_type, a.unit_identifier), ''::text) AS address_line_2,
	a.locality AS city,
	a.region AS state_or_region,
	a.postcode AS postal_code,
	a.country_code::text AS country_code,
	a.coordinates,
	c.photo_keys,
	a.id AS address_id,
	c.address_entity_id
FROM universe.org_contact c
	JOIN universe.org_address a ON a.entity_id = c.address_entity_id AND a.org_id = c.org_id AND a.valid_to IS NULL
WHERE c.valid_to IS NULL
	AND c.org_id = NULLIF(current_setting('app.current_org_id'::text, true), ''::text)::uuid
	AND NOT (EXISTS (
		SELECT 1
		FROM universe.location_suggestion ls
		WHERE ls.entity_id = c.entity_id AND ls.status = 'tentative'::text
	));
