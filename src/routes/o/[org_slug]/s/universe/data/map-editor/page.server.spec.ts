import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listMapLayersWithShapes } = vi.hoisted(() => ({ listMapLayersWithShapes: vi.fn() }));
vi.mock('$lib/server/services/map-layers.service', () => ({ listMapLayersWithShapes }));

import { load } from './+page.server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

beforeEach(() => vi.clearAllMocks());

describe('map editor load', () => {
	it("loads the org's saved layers", async () => {
		listMapLayersWithShapes.mockResolvedValue([{ id: 'l1' }]);

		const data = await load({ locals: { user: { id: 'u1' }, organization: { id: ORG, slug: 'acme' } } } as never);

		expect(data).toEqual({ organization: { id: ORG, slug: 'acme' }, layers: [{ id: 'l1' }] });
		expect(listMapLayersWithShapes).toHaveBeenCalledWith('u1', ORG);
	});

	it('answers 401 without a user or organization', async () => {
		await expect(load({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		expect(listMapLayersWithShapes).not.toHaveBeenCalled();
	});
});
