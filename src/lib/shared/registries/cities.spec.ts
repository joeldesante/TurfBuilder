import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';

describe('CITIES', () => {
	it('has unique ids and sensible boxes', () => {
		const ids = CITIES.map((city) => city.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const { bounds } of CITIES) {
			const [west, south, east, north] = bounds;
			expect(west).toBeLessThan(east);
			expect(south).toBeLessThan(north);
			expect(west).toBeGreaterThan(-180);
			expect(east).toBeLessThan(180);
			expect(south).toBeGreaterThan(-90);
			expect(north).toBeLessThan(90);
		}
	});

	it('includes the cities with portals we search', () => {
		const names = CITIES.map((city) => city.name);
		for (const name of ['Philadelphia', 'Chicago', 'New York', 'Washington', 'Miami', 'London', 'Toronto']) {
			expect(names).toContain(name);
		}
	});
});
