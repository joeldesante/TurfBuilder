import { describe, it, expect } from 'vitest';
import { statement, userRole, fieldOrganizerRole, campaignManagerRole } from './permissions.js';

describe('permission statement', () => {
	it('defines user resource with create, read, update, delete, ban', () => {
		expect(statement.user).toEqual(['create', 'read', 'update', 'delete', 'ban']);
	});

	it('defines turf resource with create, read, update, delete', () => {
		expect(statement.turf).toEqual(['create', 'read', 'update', 'delete']);
	});

	it('defines region resource with create, read, update, delete', () => {
		expect(statement.region).toEqual(['create', 'read', 'update', 'delete']);
	});
});

describe('role definitions', () => {
	it('creates a userRole', () => {
		expect(userRole).toBeDefined();
	});

	it('creates a fieldOrganizerRole', () => {
		expect(fieldOrganizerRole).toBeDefined();
	});

	it('creates a campaignManagerRole', () => {
		expect(campaignManagerRole).toBeDefined();
	});
});
