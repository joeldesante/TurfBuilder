import { describe, it, expect } from 'vitest';
import { checkChangeEmail } from './change-email-guard';

describe('checkChangeEmail', () => {
	it('lets a placeholder account change its email', () => {
		expect(() => checkChangeEmail('/change-email', 'import-1@fake.com')).not.toThrow();
	});

	it('refuses everyone else, and a request without a session', () => {
		expect(() => checkChangeEmail('/change-email', 'ada@example.org')).toThrow('administrator');
		expect(() => checkChangeEmail('/change-email', null)).toThrow();
	});

	it('leaves every other endpoint alone', () => {
		expect(() => checkChangeEmail('/sign-in/email', 'ada@example.org')).not.toThrow();
	});
});
