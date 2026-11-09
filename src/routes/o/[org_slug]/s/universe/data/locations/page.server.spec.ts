import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getLocationsOverview } = vi.hoisted(() => ({ getLocationsOverview: vi.fn() }));

vi.mock('$lib/server/services/locations.service', () => ({ getLocationsOverview }));

import { load } from './+page.server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BOUNDS = { west: -75.3, south: 39.9, east: -75.1, north: 40.1 };

const staff = (permissions: string[]) => ({
	user: { id: 'u1' },
	organization: { id: ORG, permissions }
});

function event(locals: unknown, page?: string) {
	const url = new URL('https://x/o/acme/s/universe/data/locations');
	if (page !== undefined) url.searchParams.set('page', page);
	return { locals, url } as never;
}

beforeEach(() => {
	vi.clearAllMocks();
	getLocationsOverview.mockResolvedValue({
		items: [{ id: 'l1' }],
		totalCount: 250,
		page: 2,
		pageSize: 100,
		bounds: BOUNDS
	});
});

describe('data/locations load', () => {
	it('asks the service for the requested page as the caller', async () => {
		await load(event(staff(['location.read']), '2'));

		expect(getLocationsOverview).toHaveBeenCalledWith('u1', ORG, 2);
	});

	it('leaves a missing page to the service to clamp', async () => {
		await load(event(staff(['location.read'])));

		expect(getLocationsOverview).toHaveBeenCalledWith('u1', ORG, 0);
	});

	it('returns the page, the opening viewport, and what the caller may change', async () => {
		const data = await load(event(staff(['location.read', 'location.update'])));

		expect(data).toEqual({
			totalCount: 250,
			page: 2,
			pageSize: 100,
			locations: [{ id: 'l1' }],
			initialBounds: BOUNDS,
			canCreate: false,
			canUpdate: true,
			canDelete: false
		});
	});

	it('passes the service refusal through', async () => {
		getLocationsOverview.mockRejectedValue({ status: 403 });

		await expect(load(event(staff([])))).rejects.toMatchObject({ status: 403 });
	});
});
