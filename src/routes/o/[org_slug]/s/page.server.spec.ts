import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getDashboard, listMapLayers } = vi.hoisted(() => ({ getDashboard: vi.fn(), listMapLayers: vi.fn() }));
vi.mock('$lib/server/services/dashboard.service', () => ({ getDashboard }));
vi.mock('$lib/server/services/map-layers.service', () => ({ listMapLayers }));

import { load } from './+page.server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

beforeEach(() => vi.clearAllMocks());

describe('the staff dashboard load', () => {
	it('loads the dashboard for the bucket and range in the address, with the map layer list', async () => {
		getDashboard.mockResolvedValue({ progress: { total: 1 }, points: [] });
		listMapLayers.mockResolvedValue([{ id: 'w1', name: 'Wards' }]);

		const data = await load({
			parent: async () => ({}),
			locals: { user: { id: 'u1' }, organization: { id: ORG } },
			url: new URL('https://x/o/acme/s?bucket=voters&range=7d')
		} as never);

		expect(data).toEqual({ progress: { total: 1 }, points: [], mapLayers: [{ id: 'w1', name: 'Wards' }] });
		expect(getDashboard).toHaveBeenCalledWith('u1', ORG, 'voters', '7d');
		expect(listMapLayers).toHaveBeenCalledWith('u1', ORG);
	});
});
