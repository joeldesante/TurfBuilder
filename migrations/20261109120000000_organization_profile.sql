-- Up Migration
-- What a new organization says about itself when it is created: what kind of organization it is,
-- what it does, and, for a candidate's campaign, where it is registered. Organizations created
-- before this have no answers, so every column is nullable (or defaults to false).

ALTER TABLE auth.organization ADD COLUMN category TEXT
	CHECK (category IN ('political', 'nonprofit', 'commercial'));

ALTER TABLE auth.organization ADD COLUMN description TEXT;

ALTER TABLE auth.organization ADD COLUMN is_candidate BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE auth.organization ADD COLUMN campaign_registration TEXT;
