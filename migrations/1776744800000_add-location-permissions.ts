import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`
		INSERT INTO registered_permission (key, name, description, scope) VALUES
		('location.read',   'View Private Locations', 'Grants access to browse locations the org has added to its private dataset.',                              'organization'),
		('location.create', 'Import Locations',        'Allows uploading CSV or GeoJSON files to add new locations to the org''s private dataset.',              'organization'),
		('location.update', 'Edit Locations',          'Allows modifying the details of locations the org has added.',                                           'organization'),
		('location.delete', 'Delete Locations',        'Allows permanently removing locations from the org''s private dataset.',                                  'organization')
	`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.sql(`DELETE FROM registered_permission WHERE key LIKE 'location.%'`);
}
