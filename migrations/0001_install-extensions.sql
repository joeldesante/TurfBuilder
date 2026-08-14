-- Up Migration
-- Mirrors SETUP_STEPS step 1: "Installing PostgreSQL extensions"

CREATE EXTENSION IF NOT EXISTS postgis;

-- Down Migration
-- Left in place deliberately. Dropping PostGIS would cascade to every
-- geometry column in the database.
