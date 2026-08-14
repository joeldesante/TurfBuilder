-- Up Migration
-- Mirrors SETUP_STEPS step 10: "Seeding system settings"
--
-- Only the defaults are seeded. base_url, application_name, and logo_src are
-- written by /setup and /infra/settings, so they are deliberately absent here.

INSERT INTO system_setting (key, value, description) VALUES
	('organizations.allow_creation', 'true', 'Whether users can create new organizations.'),
	('html.header_content', '', 'Raw HTML injected into the <head> of every page (e.g. analytics tracking scripts).'),
	('errors.cat_gifs', 'true', 'Show a cat gif on error pages.'),
	('mail.transport', 'direct', 'The mail transport used to send outgoing emails (direct or ses).'),
	('mail.domain', '', 'The domain from which outgoing emails are sent (e.g. mail.example.com).'),
	('mail.ses.region', '', 'AWS region for SES (e.g. us-east-1).')
ON CONFLICT (key) DO NOTHING;

-- Down Migration

DELETE FROM system_setting WHERE key IN (
	'organizations.allow_creation',
	'html.header_content',
	'errors.cat_gifs',
	'mail.transport',
	'mail.domain',
	'mail.ses.region'
);
