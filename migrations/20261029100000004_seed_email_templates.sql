-- Up Migration
-- Moved as-is from src/lib/server/setup-schema.ts.

-- Seeding email templates

INSERT INTO email_template (key, subject, html_body, variables) VALUES ($tpl$auth.verify_email$tpl$, $tpl$Verify your email address$tpl$, $tpl$<p>Hi {{username}},</p><p>Click the link below to verify your email address:</p><p><a href="{{verification_url}}">Verify email</a></p><p>If you did not request this, you can ignore this email.</p>$tpl$, $tpl$["username","verification_url"]$tpl$::jsonb), ($tpl$auth.reset_password$tpl$, $tpl$Reset your password$tpl$, $tpl$<p>Hi {{username}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_url}}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>$tpl$, $tpl$["username","reset_url"]$tpl$::jsonb) ON CONFLICT (key) DO NOTHING;

-- Down Migration
