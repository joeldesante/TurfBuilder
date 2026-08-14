-- Up Migration
-- Mirrors SETUP_STEPS step 2: "Creating auth schema"

CREATE SCHEMA IF NOT EXISTS auth;

-- Down Migration

DROP SCHEMA IF EXISTS auth CASCADE;
