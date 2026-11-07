import { describe, it, expect } from 'vitest';
import { isMaintenanceMode } from './maintenance';

describe('isMaintenanceMode', () => {
	it('is off when unset', () => {
		expect(isMaintenanceMode({})).toBe(false);
	});

	it.each(['true', 'TRUE', ' true '])('is on for %j', (value) => {
		expect(isMaintenanceMode({ MAINTENANCE_MODE: value })).toBe(true);
	});

	it.each(['false', '', '1', 'yes'])('is off for %j', (value) => {
		expect(isMaintenanceMode({ MAINTENANCE_MODE: value })).toBe(false);
	});
});
