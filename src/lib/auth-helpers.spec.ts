import { describe, it, expect } from 'vitest';
import { hasSystemAccess } from './auth-helpers.js';

describe('hasSystemAccess', () => {
	describe('non-privileged input', () => {
		it('returns false for null', () => {
			expect(hasSystemAccess(null)).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(hasSystemAccess(undefined)).toBe(false);
		});

		it('returns false for an empty string', () => {
			expect(hasSystemAccess('')).toBe(false);
		});

		it('returns false for the base user role', () => {
			expect(hasSystemAccess('user')).toBe(false);
		});

		it('returns false for an unrecognized role', () => {
			expect(hasSystemAccess('superuser')).toBe(false);
		});
	});

	describe('privileged roles', () => {
		it('returns true for fieldOrganizer', () => {
			expect(hasSystemAccess('fieldOrganizer')).toBe(true);
		});

		it('returns true for campaignManager', () => {
			expect(hasSystemAccess('campaignManager')).toBe(true);
		});

		it('returns true for admin', () => {
			expect(hasSystemAccess('admin')).toBe(true);
		});
	});

	describe('comma-separated role lists', () => {
		it('returns true when at least one role is privileged', () => {
			expect(hasSystemAccess('user,fieldOrganizer')).toBe(true);
		});

		it('trims whitespace around roles', () => {
			expect(hasSystemAccess('user, admin')).toBe(true);
		});

		it('returns false when all roles are non-privileged', () => {
			expect(hasSystemAccess('user,viewer')).toBe(false);
		});
	});
});
