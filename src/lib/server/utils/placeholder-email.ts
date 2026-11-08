/**
 * Accounts made without a real address (imported users, accounts an admin
 * created by hand) get one at this domain. They must set a real address before
 * using the app, and only they may change their email.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'fake.com';

/** Whether `email` is a placeholder address. */
export function isPlaceholderEmail(email: string): boolean {
	return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}
