-- Up Migration
-- better-auth's two-factor plugin (1.6) writes whether a TOTP secret has been
-- verified. Without the column, turning on two-factor fails with
-- 'column "verified" of relation "two_factor" does not exist'. Existing rows
-- were made by the older plugin only after a code was verified, so they
-- count as verified.

ALTER TABLE auth.two_factor ADD COLUMN verified BOOLEAN NOT NULL DEFAULT true;

-- Down Migration

ALTER TABLE auth.two_factor DROP COLUMN verified;
