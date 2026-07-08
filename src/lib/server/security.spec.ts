import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted((): Record<string, string | undefined> => ({}));

vi.mock('$env/dynamic/private', () => ({
	env: mockEnv
}));

import { isEmailVerificationDisabled } from './security';

describe('isEmailVerificationDisabled', () => {
	beforeEach(() => {
		delete mockEnv.__SECURITY_DISABLE_EMAIL_VERIFICATION;
	});

	it('returns false when the variable is not set', () => {
		expect(isEmailVerificationDisabled()).toBe(false);
	});

	it('returns false when set to "false"', () => {
		mockEnv.__SECURITY_DISABLE_EMAIL_VERIFICATION = 'false';
		expect(isEmailVerificationDisabled()).toBe(false);
	});

	it('returns true when set to "true"', () => {
		mockEnv.__SECURITY_DISABLE_EMAIL_VERIFICATION = 'true';
		expect(isEmailVerificationDisabled()).toBe(true);
	});

	it('returns true when set to "TRUE" (case-insensitive)', () => {
		mockEnv.__SECURITY_DISABLE_EMAIL_VERIFICATION = 'TRUE';
		expect(isEmailVerificationDisabled()).toBe(true);
	});

	it('returns false for any other value', () => {
		mockEnv.__SECURITY_DISABLE_EMAIL_VERIFICATION = '1';
		expect(isEmailVerificationDisabled()).toBe(false);
	});
});
