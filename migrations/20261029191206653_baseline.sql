-- Up Migration
-- Baseline. Staging and production already have their schema from the
-- original setup steps (src/lib/server/setup-schema.ts), so this records the
-- starting point and changes nothing. The schema itself moves into migration
-- files later; until then a schema change still goes through setup-schema.ts.

-- Down Migration
