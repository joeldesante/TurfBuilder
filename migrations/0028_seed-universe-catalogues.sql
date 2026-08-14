-- Up Migration
-- Mirrors SETUP_STEPS step 28: "Seeding universe catalogues"
--
-- universe.set_entity_type resolves these slugs at insert time, so the entity
-- type rows must exist before any version row is written.

INSERT INTO universe.entity_type (slug, name, description) VALUES
	('person',       'Person',       'A human individual'),
	('organization', 'Organization', 'A business, non-profit, government body, or other group'),
	('location',     'Location',     'A physical place in the world'),
	('asset',        'Asset',        'A physical object such as a vehicle, device, or package')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO universe.organization_type (slug, name, description) VALUES
	('business',          'Business',          'A for-profit commercial entity'),
	('non-profit',        'Non-Profit',         'A not-for-profit organization'),
	('government',        'Government',         'A government body or agency'),
	('educational',       'Educational',        'A school, university, or educational institution'),
	('political',         'Political',          'A political party, campaign, or PAC'),
	('religious',         'Religious',          'A religious organization or institution'),
	('intergovernmental', 'Intergovernmental',  'An intergovernmental organization (e.g. UN, NATO)'),
	('sovereign-entity',  'Sovereign Entity',   'A sovereign state or territory')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO universe.relationship_type (slug, name, inverse_slug, inverse_name, description) VALUES
	('located_at',    'Located At',    'location_of',    'Location Of',    'An entity is physically located at a location'),
	('resident',      'Resident',      'residence_of',   'Residence Of',   'A person resides at a location'),
	('employed_by',   'Employed By',   'employs',        'Employs',        'A person is employed by an organization'),
	('owned_by',      'Owned By',      'owns',           'Owns',           'An entity is owned by another entity'),
	('member_of',     'Member Of',     'has_member',     'Has Member',     'A person is a member of an organization'),
	('subsidiary_of', 'Subsidiary Of', 'has_subsidiary', 'Has Subsidiary', 'An organization is a subsidiary of another'),
	('delivers_to',   'Delivers To',   'delivered_by',   'Delivered By',   'An entity delivers to a location or organization')
ON CONFLICT (slug) DO NOTHING;

-- Down Migration

DELETE FROM universe.relationship_type WHERE slug IN (
	'located_at', 'resident', 'employed_by', 'owned_by',
	'member_of', 'subsidiary_of', 'delivers_to'
);

DELETE FROM universe.organization_type WHERE slug IN (
	'business', 'non-profit', 'government', 'educational',
	'political', 'religious', 'intergovernmental', 'sovereign-entity'
);

DELETE FROM universe.entity_type WHERE slug IN ('person', 'organization', 'location', 'asset');
