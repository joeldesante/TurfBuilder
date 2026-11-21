import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ listBucketLocations: vi.fn(), getBucketMapOverview: vi.fn() }));
vi.mock('$lib/server/services/buckets.service', () => svc);
const { listMapLayers } = vi.hoisted(() => ({ listMapLayers: vi.fn() }));
vi.mock('$lib/server/services/map-layers.service', () => ({ listMapLayers }));

import { load } from './+page.server';

const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const filters = { v: 2, people: null, locations: { operator: 'AND', filters: [] } };

const event = (bucket: unknown, query = '') =>
	({
		parent: async () => ({ bucket }),
		locals: { user: { id: 'u1' }, organization: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
		url: new URL(`https://x/o/acme/s/universe/buckets/voters/locations${query}`)
	}) as never;

beforeEach(() => vi.clearAllMocks());

describe('the bucket locations page', () => {
	it("answers 422 with the reason when the bucket's old filters could not be converted", async () => {
		await expect(load(event({ filters: null, problem: 'could not be converted' }))).rejects.toMatchObject({
			status: 422,
			body: { message: 'could not be converted' }
		});
	});

	it('is empty and disabled when the bucket does not include locations', async () => {
		const result = await load(event({ id: BUCKET, filters: { ...filters, locations: null }, problem: null }));

		expect(result).toMatchObject({ enabled: false, totalCount: 0, locations: [], map: { total: 0, bounds: null } });
		expect(svc.listBucketLocations).not.toHaveBeenCalled();
	});

	it('loads one page of the list by default', async () => {
		svc.listBucketLocations.mockResolvedValue({ items: [{ id: 'l1' }], totalCount: 1, page: 1, pageSize: 100 });

		const result = await load(event({ id: BUCKET, filters, problem: null }, '?page=1'));

		expect(result).toMatchObject({ view: 'list', enabled: true, locations: [{ id: 'l1' }] });
		expect(svc.getBucketMapOverview).not.toHaveBeenCalled();
		expect(listMapLayers).not.toHaveBeenCalled();
	});

	it('loads where the map opens instead of a page with ?view=map', async () => {
		const map = { total: 12000, bounds: { west: -98, south: 29, east: -96, north: 31 } };
		svc.getBucketMapOverview.mockResolvedValue(map);
		listMapLayers.mockResolvedValue([{ id: 'w1', name: 'Wards' }]);

		const result = await load(event({ id: BUCKET, filters, problem: null }, '?view=map'));

		expect(result).toMatchObject({ view: 'map', map, mapLayers: [{ id: 'w1', name: 'Wards' }], locations: [] });
		expect(listMapLayers).toHaveBeenCalledWith('u1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
		expect(svc.getBucketMapOverview).toHaveBeenCalledWith('u1', BUCKET);
		expect(svc.listBucketLocations).not.toHaveBeenCalled();
	});
});
