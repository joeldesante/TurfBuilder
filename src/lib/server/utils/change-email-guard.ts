import { APIError } from 'better-auth/api';
import { isPlaceholderEmail } from '$lib/server/utils/placeholder-email';

/**
 * better-auth's change-email endpoint is on so that accounts with a
 * placeholder address can set a real one (/auth/update-email); the link goes
 * to the new address, which only changes once it is followed. Nobody else may
 * use it: a real address is changed by an admin, so a stolen session cannot
 * quietly move an account to a new inbox.
 */
export function checkChangeEmail(path: string, sessionEmail: string | null | undefined): void {
	if (path !== '/change-email') return;
	if (!sessionEmail || !isPlaceholderEmail(sessionEmail)) {
		throw new APIError('FORBIDDEN', { message: 'Your email address can only be changed by an administrator.' });
	}
}
