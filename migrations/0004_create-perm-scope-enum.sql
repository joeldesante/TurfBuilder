-- Up Migration
-- Mirrors SETUP_STEPS step 4: "Creating permission scope enum"
--
-- CREATE TYPE has no IF NOT EXISTS, so the DO block carries the idempotency.

DO $$ BEGIN
	CREATE TYPE perm_scope AS ENUM ('organization', 'infrastructure');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Down Migration

DROP TYPE IF EXISTS perm_scope;
