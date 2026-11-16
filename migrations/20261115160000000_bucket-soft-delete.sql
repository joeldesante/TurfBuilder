-- Up Migration
-- A bucket can be deleted from its settings page. The row stays, marked with
-- deleted_at, so its lists, surveys, scripts, and turfs keep their parent and
-- nothing is lost; every read of buckets skips rows with deleted_at set.

ALTER TABLE universe.bucket ADD COLUMN deleted_at timestamptz;

-- A deleted bucket must not hold on to its slug, so the unique rule covers only
-- buckets that are still live.
ALTER TABLE universe.bucket DROP CONSTRAINT bucket_org_slug_unique;

CREATE UNIQUE INDEX bucket_org_slug_live_unique
	ON universe.bucket (org_id, slug)
	WHERE deleted_at IS NULL;

-- Down Migration

DROP INDEX universe.bucket_org_slug_live_unique;

-- Fails if a deleted bucket shares a slug with a live one; resolve that first.
ALTER TABLE universe.bucket ADD CONSTRAINT bucket_org_slug_unique UNIQUE (org_id, slug);

ALTER TABLE universe.bucket DROP COLUMN deleted_at;
