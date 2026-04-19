import { describe, it, expect } from 'vitest';
import {
	PERMISSIONS,
	VALID_PERMISSION_KEYS,
	PERMISSION_GROUPS
} from './permissions-config';

describe('permissions-config', () => {
	describe('PERMISSIONS', () => {
		it('is a non-empty array', () => {
			expect(PERMISSIONS.length).toBeGreaterThan(0);
		});

		it('every entry has required fields', () => {
			for (const perm of PERMISSIONS) {
				expect(perm.key).toBeTruthy();
				expect(perm.group).toBeTruthy();
				expect(perm.label).toBeTruthy();
				expect(perm.verbPhrase).toBeTruthy();
				expect(perm.description).toBeTruthy();
			}
		});

		it('every key follows the resource.action format', () => {
			for (const perm of PERMISSIONS) {
				expect(perm.key).toMatch(/^[a-z]+\.[a-z]+$/);
			}
		});

		it('contains expected permission keys', () => {
			const keys = PERMISSIONS.map((p) => p.key);
			expect(keys).toContain('canvass.use');
			expect(keys).toContain('turf.create');
			expect(keys).toContain('survey.read');
			expect(keys).toContain('member.read');
			expect(keys).toContain('plugin.manage');
		});

		it('has no duplicate keys', () => {
			const keys = PERMISSIONS.map((p) => p.key);
			const unique = new Set(keys);
			expect(unique.size).toBe(keys.length);
		});
	});

	describe('VALID_PERMISSION_KEYS', () => {
		it('is a Set containing all PERMISSIONS keys', () => {
			for (const perm of PERMISSIONS) {
				expect(VALID_PERMISSION_KEYS.has(perm.key)).toBe(true);
			}
		});

		it('has the same size as PERMISSIONS', () => {
			expect(VALID_PERMISSION_KEYS.size).toBe(PERMISSIONS.length);
		});

		it('does not contain unknown keys', () => {
			expect(VALID_PERMISSION_KEYS.has('foo:bar')).toBe(false);
		});
	});

	describe('PERMISSION_GROUPS', () => {
		it('is a non-empty array', () => {
			expect(PERMISSION_GROUPS.length).toBeGreaterThan(0);
		});

		it('every group has a name and permissions array', () => {
			for (const group of PERMISSION_GROUPS) {
				expect(group.name).toBeTruthy();
				expect(Array.isArray(group.permissions)).toBe(true);
				expect(group.permissions.length).toBeGreaterThan(0);
			}
		});

		it('covers all permissions — union of groups equals PERMISSIONS', () => {
			const allGroupedKeys = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
			const allPermKeys = PERMISSIONS.map((p) => p.key);
			expect(allGroupedKeys.sort()).toEqual(allPermKeys.sort());
		});

		it('contains expected groups', () => {
			const groupNames = PERMISSION_GROUPS.map((g) => g.name);
			expect(groupNames).toContain('Canvassing');
			expect(groupNames).toContain('Surveys');
			expect(groupNames).toContain('Members');
		});
	});
});
