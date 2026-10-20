/**
 * The email templates the app sends, with the text each starts from. The
 * database holds the editable copy; this list is what "Reset to default"
 * restores and what a fresh install is seeded with. Add a template here and
 * the migration step creates it.
 */

export interface EmailTemplateDefault {
	key: string;
	/** What an admin calls it. */
	name: string;
	/** When it is sent. */
	description: string;
	subject: string;
	htmlBody: string;
	/** The {{variables}} the sender fills in. */
	variables: string[];
	/** Values for the preview and test sends. */
	sample: Record<string, string>;
}

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
	{
		key: 'auth.verify_email',
		name: 'Verify email address',
		description: 'Sent when someone signs up, changes their email, or an admin resends verification.',
		subject: 'Verify your email address',
		htmlBody:
			'<p>Hi {{username}},</p><p>Click the link below to verify your email address:</p><p><a href="{{verification_url}}">Verify email</a></p><p>If you did not request this, you can ignore this email.</p>',
		variables: ['username', 'verification_url'],
		sample: { username: 'Ada', verification_url: 'https://example.com/verify?token=sample' }
	},
	{
		key: 'auth.reset_password',
		name: 'Reset password',
		description: 'Sent when someone asks to reset their password, or an admin sends a reset.',
		subject: 'Reset your password',
		htmlBody:
			'<p>Hi {{username}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_url}}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>',
		variables: ['username', 'reset_url'],
		sample: { username: 'Ada', reset_url: 'https://example.com/reset?token=sample' }
	}
];

export const EMAIL_TEMPLATES_BY_KEY = new Map(EMAIL_TEMPLATE_DEFAULTS.map((template) => [template.key, template]));
