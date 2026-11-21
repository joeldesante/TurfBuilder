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

const svc = vi.hoisted(() => ({ getMapLayer: vi.fn(), updateMapLayer: vi.fn(), deleteMapLayer: vi.fn() }));
vi.mock('$lib/server/services/map-layers.service', () => svc);

import { GET, PATCH, DELETE } from './+server';

const LAYER = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const signedIn = { user: { id: 'u1' } };

function patch(body: unknown, id = LAYER) {
	return PATCH({
		params: { map_layer_id: id },
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/map-layers/[map_layer_id]', () => {
	it('returns one layer with its shapes', async () => {
		svc.getMapLayer.mockResolvedValue({ id: LAYER, geojson: { type: 'FeatureCollection', features: [] } });

		const res = await GET({ params: { map_layer_id: LAYER }, locals: signedIn } as never);

		expect(await res.json()).toMatchObject({ id: LAYER, geojson: { type: 'FeatureCollection' } });
		expect(svc.getMapLayer).toHaveBeenCalledWith('u1', LAYER);
	});

	it('passes only the fields sent', async () => {
		svc.updateMapLayer.mockResolvedValue({ id: LAYER });

		await patch({ color: '#e63946', label_field: null });

		expect(svc.updateMapLayer).toHaveBeenCalledWith('u1', LAYER, {
			color: '#e63946',
			label_field: null
		});
	});

	it('answers 400 for an empty body, a bad color, or a malformed id', async () => {
		await expect(patch({})).rejects.toMatchObject({ status: 400 });
		await expect(patch({ color: 'red' })).rejects.toMatchObject({ status: 400 });
		await expect(patch({ name: 'a' }, 'x')).rejects.toMatchObject({ status: 400 });
		expect(svc.updateMapLayer).not.toHaveBeenCalled();
	});

	it('deletes and answers 204, or 401 when signed out', async () => {
		const res = await DELETE({ params: { map_layer_id: LAYER }, locals: signedIn } as never);

		expect(res.status).toBe(204);
		expect(svc.deleteMapLayer).toHaveBeenCalledWith('u1', LAYER);
		await expect(
			DELETE({ params: { map_layer_id: LAYER }, locals: {} } as never)
		).rejects.toMatchObject({ status: 401 });
	});
});
