-- Up Migration
-- Mirrors SETUP_STEPS step 12: "Creating universe schema"

CREATE SCHEMA IF NOT EXISTS universe;

-- Down Migration

DROP SCHEMA IF EXISTS universe CASCADE;
