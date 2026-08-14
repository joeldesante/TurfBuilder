-- Up Migration
-- Mirrors SETUP_STEPS step 11: "Seeding email templates"

INSERT INTO email_template (key, subject, html_body, variables) VALUES
	(
		'auth.verify_email',
		'Verify your email address',
		'<p>Hi {{username}},</p><p>Click the link below to verify your email address:</p><p><a href="{{verification_url}}">Verify email</a></p><p>If you did not request this, you can ignore this email.</p>',
		'["username", "verification_url"]'
	),
	(
		'auth.reset_password',
		'Reset your password',
		'<p>Hi {{username}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_url}}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>',
		'["username", "reset_url"]'
	)
ON CONFLICT (key) DO NOTHING;

-- Down Migration

DELETE FROM email_template WHERE key IN ('auth.verify_email', 'auth.reset_password');
