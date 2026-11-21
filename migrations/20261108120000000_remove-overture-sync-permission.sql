-- Up Migration
-- The Overture import is gone, so its infrastructure permission goes with it.
DO $$
DECLARE
	perm_id UUID;
BEGIN
	SELECT id INTO perm_id FROM registered_permission
		WHERE scope = 'infrastructure' AND key = 'locations.overture_sync';
	IF perm_id IS NULL THEN
		RAISE EXCEPTION 'registered_permission locations.overture_sync is missing';
	END IF;
	DELETE FROM permission_role_entry WHERE registered_permission_id = perm_id;
	DELETE FROM registered_permission WHERE id = perm_id;
END $$;

DELETE FROM system_setting WHERE key = 'integration.overture_maps.enabled';

-- Down Migration
