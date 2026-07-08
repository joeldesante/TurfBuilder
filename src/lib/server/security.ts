import { env } from '$env/dynamic/private';

/**
 * When __SECURITY_DISABLE_EMAIL_VERIFICATION is set to "true", pages that
 * normally require a verified email address skip that check. Any other value
 * (or the variable being unset) keeps the default behavior.
 */
export function isEmailVerificationDisabled(): boolean {
	return env.__SECURITY_DISABLE_EMAIL_VERIFICATION?.toLowerCase() === 'true';
}
