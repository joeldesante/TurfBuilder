-- Up Migration
-- Mirrors SETUP_STEPS step 20: "Binding universe entity type triggers"
--
-- Each version table stamps its parent entity with the matching entity_type on
-- first insert. The slug is passed as a trigger argument.

DROP TRIGGER IF EXISTS set_entity_type ON universe.public_person;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.public_person
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('person');

DROP TRIGGER IF EXISTS set_entity_type ON universe.public_organization;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.public_organization
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('organization');

DROP TRIGGER IF EXISTS set_entity_type ON universe.public_location;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.public_location
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('location');

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_person;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.org_person
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('person');

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_organization;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.org_organization
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('organization');

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_location;
CREATE TRIGGER set_entity_type
	BEFORE INSERT ON universe.org_location
	FOR EACH ROW EXECUTE FUNCTION universe.set_entity_type('location');

-- Down Migration

DROP TRIGGER IF EXISTS set_entity_type ON universe.org_location;
DROP TRIGGER IF EXISTS set_entity_type ON universe.org_organization;
DROP TRIGGER IF EXISTS set_entity_type ON universe.org_person;
DROP TRIGGER IF EXISTS set_entity_type ON universe.public_location;
DROP TRIGGER IF EXISTS set_entity_type ON universe.public_organization;
DROP TRIGGER IF EXISTS set_entity_type ON universe.public_person;
