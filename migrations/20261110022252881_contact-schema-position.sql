-- Up Migration
-- Staff order the contact schema tabs by dragging them. The order is shared by
-- the whole organization, so it is stored on the schema. Existing schemas are
-- numbered by name, which is how they were listed before.

ALTER TABLE universe.contact_schema ADD COLUMN position integer;

UPDATE universe.contact_schema cs
SET position = ranked.position
FROM (
	SELECT id, (row_number() OVER (PARTITION BY org_id ORDER BY schema_name, id) - 1)::integer AS position
	FROM universe.contact_schema
) ranked
WHERE cs.id = ranked.id;

ALTER TABLE universe.contact_schema
	ALTER COLUMN position SET NOT NULL,
	ALTER COLUMN position SET DEFAULT 0,
	ADD CONSTRAINT contact_schema_position_nonnegative CHECK (position >= 0);

-- Down Migration

ALTER TABLE universe.contact_schema DROP COLUMN position;
