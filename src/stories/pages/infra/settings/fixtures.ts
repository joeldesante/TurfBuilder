import { SYSTEM_SETTINGS } from '$lib/shared/registries/system-settings';
import type { SystemSettingValue } from '$lib/shared/types/system-settings';
import type { EmailTemplateDetail, EmailTemplateSummary } from '$lib/shared/types/email-templates';
import type { EmailLogEntry } from '$lib/shared/types/activity';

/** Every setting at its default, as a fresh install shows them. */
export const settings: SystemSettingValue[] = SYSTEM_SETTINGS.map((s) => ({
	key: s.key,
	value: s.key === 'application_name' ? 'TurfBuilder' : s.defaultValue,
	updatedAt: s.key === 'application_name' ? '2026-10-01T10:00:00.000Z' : null
}));

export const credentials = { aws: false, storageAccessKey: true, storageSecretKey: true };

export const templates: EmailTemplateSummary[] = [
	{
		key: 'auth.verify_email',
		name: 'Verify email address',
		description: 'Sent when someone signs up, changes their email, or an admin resends verification.',
		subject: 'Verify your email address',
		variables: ['username', 'verification_url'],
		customized: false,
		updatedAt: '2026-09-01T10:00:00.000Z'
	},
	{
		key: 'auth.reset_password',
		name: 'Reset password',
		description: 'Sent when someone asks to reset their password, or an admin sends a reset.',
		subject: 'Choose a new password',
		variables: ['username', 'reset_url'],
		customized: true,
		updatedAt: '2026-10-10T10:00:00.000Z'
	}
];

export const templateDetail: EmailTemplateDetail = {
	...templates[1],
	htmlBody: '<p>Hi {{username}},</p><p><a href="{{reset_url}}">Reset password</a></p>',
	sample: { username: 'Ada', reset_url: 'https://example.com/reset?token=sample' }
};

export const emailLog: EmailLogEntry[] = [
	{ id: '3', recipient: 'ada@example.com', template: 'auth.reset_password', subject: 'Choose a new password', status: 'sent', error: null, createdAt: '2026-10-19T10:00:00.000Z' },
	{ id: '2', recipient: 'alan@example.com', template: 'auth.verify_email', subject: 'Verify your email address', status: 'failed', error: 'Connection refused', createdAt: '2026-10-18T10:00:00.000Z' },
	{ id: '1', recipient: 'grace@example.com', template: 'auth.verify_email', subject: null, status: 'skipped', error: 'Mail is not configured.', createdAt: '2026-10-17T10:00:00.000Z' }
];

export const emailLogPage = { items: emailLog, totalCount: emailLog.length, page: 1, pageSize: 100 };
