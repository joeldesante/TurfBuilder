import { describe, it, expect } from 'vitest';
import { hasSystemAccess, can, hasInfraPermission } from './auth-helpers.js';

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
		it('returns true for admin', () => {
			expect(hasSystemAccess('admin')).toBe(true);
		});
	});

	describe('comma-separated role lists', () => {
		it('trims whitespace around roles', () => {
			expect(hasSystemAccess('user, admin')).toBe(true);
		});

		it('returns false when all roles are non-privileged', () => {
			expect(hasSystemAccess('user,viewer')).toBe(false);
		});
	});
});

describe('can', () => {
	const makeOrg = (permissions: string[]) => ({
		id: 'org-1',
		name: 'Test Org',
		slug: 'test-org',
		role: { id: 'group-1', name: 'Test Group', permissions }
	});

	it('returns false when organization is undefined', () => {
		expect(can(undefined, 'turf', 'create')).toBe(false);
	});

	it('returns false when organization has no role', () => {
		expect(can({ id: 'org-1', name: 'Test Org', slug: 'test-org' }, 'turf', 'create')).toBe(false);
	});

	it('returns true when the permission is present', () => {
		expect(can(makeOrg(['turf.create', 'survey.read']), 'turf', 'create')).toBe(true);
	});

	it('returns false when the permission is absent', () => {
		expect(can(makeOrg(['survey.read']), 'turf', 'create')).toBe(false);
	});

	it('returns false for an empty permissions array', () => {
		expect(can(makeOrg([]), 'turf', 'create')).toBe(false);
	});

	it('does not partially match permission keys', () => {
		expect(can(makeOrg(['turf.create']), 'turf', 'creat')).toBe(false);
		expect(can(makeOrg(['turf.create']), 'urf', 'create')).toBe(false);
	});

	it('checks resource.action format with a dot separator', () => {
		// Ensure old colon-separated format is rejected
		expect(can(makeOrg(['turf:create']), 'turf', 'create')).toBe(false);
	});
});

describe('hasInfraPermission', () => {
	it('returns true when the permission is present', () => {
		expect(hasInfraPermission(['access', 'users.manage'], 'access')).toBe(true);
	});

	it('returns false when the permission is absent', () => {
		expect(hasInfraPermission(['access'], 'users.manage')).toBe(false);
	});

	it('returns false for an empty array', () => {
		expect(hasInfraPermission([], 'access')).toBe(false);
	});

	it('does not partially match', () => {
		expect(hasInfraPermission(['access'], 'acces')).toBe(false);
	});
});
