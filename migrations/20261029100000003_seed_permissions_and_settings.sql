-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Seeding permission catalog

INSERT INTO registered_permission (key, name, description, scope) VALUES
				('system.access',    'Staff Dashboard Access',  'Grants access to the staff dashboard (/s/). Required to manage the organization.',                        'organization'),
				('canvass.use',      'Use Canvassing',          'Allows entering turf codes and using the canvassing app to collect responses in the field.',               'organization'),
				('turf.read',        'View Turfs',              'Grants access to the Turfs page to see the full list of canvassing areas and their assignments.',           'organization'),
				('turf.create',      'Cut New Turfs',           'Allows drawing and defining new turf boundaries using the map tool.',                                      'organization'),
				('turf.update',      'Edit Turfs',              'Allows renaming and modifying the boundaries of turfs that have already been created.',                    'organization'),
				('turf.delete',      'Delete Turfs',            'Allows permanently removing turfs from the organization.',                                                  'organization'),
				('survey.read',      'View Surveys',            'Grants access to the Surveys page to browse all survey templates.',                                         'organization'),
				('survey.create',    'Create Surveys',          'Allows building new survey templates for canvassers to use in the field.',                                  'organization'),
				('survey.update',    'Edit Surveys',            'Allows modifying the questions, answers, and settings of existing surveys.',                                'organization'),
				('survey.delete',    'Delete Surveys',          'Allows permanently removing surveys and all of their associated questions.',                                 'organization'),
				('response.read',    'View Responses',          'Grants access to the Responses page to see all data collected in the field.',                               'organization'),
				('response.delete',  'Delete Responses',        'Allows permanently removing individual canvassing responses from the organization.',                        'organization'),
				('member.read',      'View Members',            'Grants access to the Members page to see who belongs to the organization.',                                 'organization'),
				('member.invite',    'Invite Members',          'Allows sending invitations to new members to join the organization.',                                       'organization'),
				('member.update',    'Manage Member Roles',     'Allows changing the role assigned to any member within the organization.',                                  'organization'),
				('member.delete',    'Remove Members',          'Allows kicking members out of the organization entirely.',                                                  'organization'),
				('location.read',    'View Locations',          'Grants access to the Locations page to browse imported address data.',                                      'organization'),
				('location.create',  'Import Locations',        'Allows importing new address or location data into the organization.',                                      'organization'),
				('location.update',  'Edit Locations',          'Allows editing existing location records.',                                                                 'organization'),
				('location.delete',  'Delete Locations',        'Allows permanently removing location records from the organization.',                                       'organization'),
				('role.read',        'View Roles',              'Grants access to view roles and their permission assignments.',                                              'organization'),
				('role.create',      'Create Roles',            'Allows creating new permission roles for the organization.',                                                 'organization'),
				('role.update',      'Edit Roles',              'Allows modifying the name and permissions of existing roles.',                                               'organization'),
				('role.delete',      'Delete Roles',            'Allows permanently removing custom permission roles.',                                                       'organization'),
				('plugin.manage',    'Manage Plugins',          'Allows enabling and disabling plugins and changing their configuration for this organization.',              'organization'),
				('access',                   'Infrastructure Access',   'Grants access to the /infra infrastructure management panel.',                                      'infrastructure'),
				('locations.overture_sync',  'Trigger Overture Sync',  'Allows triggering an Overture Maps data sync to update the global location pool.',                  'infrastructure'),
				('users.manage',             'Manage Infra Users',      'Allows granting and revoking infrastructure permissions for other users.',                          'infrastructure'),
				('settings.manage',          'Manage System Settings',  'Allows viewing and editing system-wide settings.',                                                  'infrastructure')
			ON CONFLICT (scope, key) DO NOTHING;

-- Seeding system settings

INSERT INTO system_setting (key, value, description) VALUES
				('organizations.allow_creation', 'true', 'Whether users can create new organizations.'),
				('html.header_content', '', 'Raw HTML injected into the <head> of every page (e.g. analytics tracking scripts).'),
				('errors.cat_gifs', 'true', 'Show a cat gif on error pages.'),
				('mail.transport', 'direct', 'The mail transport used to send outgoing emails (direct or ses).'),
				('mail.domain', '', 'The domain from which outgoing emails are sent (e.g. mail.example.com).'),
				('mail.ses.region', '', 'AWS region for SES (e.g. us-east-1).'),
				('spaces.endpoint', '', 'DigitalOcean Spaces endpoint for photos and generated documents (e.g. https://nyc3.digitaloceanspaces.com). Access keys come from SPACES_ACCESS_KEY_ID and SPACES_SECRET_ACCESS_KEY in the environment.'),
				('spaces.region', '', 'DigitalOcean Spaces region (e.g. nyc3). Defaults to us-east-1 when empty.'),
				('spaces.bucket', '', 'DigitalOcean Spaces bucket name.')
			ON CONFLICT (key) DO NOTHING;

-- Down Migration
