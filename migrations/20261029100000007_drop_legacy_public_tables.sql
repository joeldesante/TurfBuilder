-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Dropping legacy public schema tables

DROP VIEW IF EXISTS location_unified;

DROP TABLE IF EXISTS survey_question_response CASCADE;

DROP TABLE IF EXISTS turf_location_attempt CASCADE;

DROP TABLE IF EXISTS turf_user CASCADE;

DROP TABLE IF EXISTS turf_location CASCADE;

DROP TABLE IF EXISTS turf CASCADE;

DROP TABLE IF EXISTS survey_question CASCADE;

DROP TABLE IF EXISTS survey CASCADE;

DROP TABLE IF EXISTS org_location CASCADE;

DROP TABLE IF EXISTS location CASCADE;

DROP FUNCTION IF EXISTS update_geometry() CASCADE;

-- Down Migration
