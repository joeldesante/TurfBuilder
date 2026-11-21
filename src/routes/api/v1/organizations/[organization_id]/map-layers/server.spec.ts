import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const svc = vi.hoisted(() => ({ listMapLayers: vi.fn(), createMapLayer: vi.fn() }));
vi.mock('$lib/server/services/map-layers.service', () => svc);

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG };
const signedIn = { user: { id: 'u1' } };
const geojson = { type: 'FeatureCollection', features: [] };

function post(body: unknown) {
	return POST({
		params,
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/organizations/[organization_id]/map-layers', () => {
	it('answers 401 when signed out and 400 for a malformed id', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			GET({ params: { organization_id: 'x' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('lists the org layers', async () => {
		svc.listMapLayers.mockResolvedValue([{ id: 'l1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 'l1' }]);
		expect(svc.listMapLayers).toHaveBeenCalledWith('u1', ORG);
	});

	it('creates a layer with a trimmed name and no label by default, and answers 201', async () => {
		svc.createMapLayer.mockResolvedValue({ id: 'l1' });

		const res = await post({ name: ' Wards ', color: '#2f6fed', geojson });

		expect(res.status).toBe(201);
		expect(svc.createMapLayer).toHaveBeenCalledWith('u1', ORG, {
			name: 'Wards',
			color: '#2f6fed',
			label_field: null,
			geojson
		});
	});

	it('answers 400 for a blank name, a bad color, or something that is not GeoJSON', async () => {
		await expect(post({ name: ' ', color: '#2f6fed', geojson })).rejects.toMatchObject({ status: 400 });
		await expect(post({ name: 'a', color: 'blue', geojson })).rejects.toMatchObject({ status: 400 });
		await expect(post({ name: 'a', color: '#2f6fed', geojson: { type: 'Map' } })).rejects.toMatchObject({
			status: 400
		});
		await expect(post({ name: 'a', color: '#2f6fed', geojson: [] })).rejects.toMatchObject({ status: 400 });
		expect(svc.createMapLayer).not.toHaveBeenCalled();
	});
});
