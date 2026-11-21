-- Up Migration
-- Invite link times were TIMESTAMP without a zone, so an expiry picked as
-- "Dec 31" was stored as midnight UTC: it showed as Dec 30 west of UTC and the
-- link died at the start of the day it was meant to last through. With a zone,
-- the app stores the end of the chosen day in the picker's own time zone.
-- Existing values were written by a server in UTC, so they are read as UTC.

ALTER TABLE org_invite_link
	ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
	ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Down Migration

ALTER TABLE org_invite_link
	ALTER COLUMN expires_at TYPE TIMESTAMP USING expires_at AT TIME ZONE 'UTC',
	ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC';
