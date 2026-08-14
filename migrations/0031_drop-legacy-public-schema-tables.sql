-- Up Migration
-- Mirrors SETUP_STEPS step 31: "Dropping legacy public schema tables"
--
-- These tables predate the universe schema and are fully superseded by
-- universe.survey, universe.turf, and the universe location tables. No
-- migration in this directory creates them, so on a fresh database every
-- statement here is a no-op; the step exists to converge databases that were
-- built by the pre-universe schema.
--
-- DESTRUCTIVE. Unlike the /infra/migrate runner, which re-executed these drops
-- on every click, node-pg-migrate runs this exactly once and records it. If a
-- database still holds live data in these tables, that data has not been moved
-- into the universe schema and this migration will destroy it. Verify before
-- applying to any database that predates the universe cutover.

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

-- No down migration: the dropped tables and their data cannot be reconstructed.
