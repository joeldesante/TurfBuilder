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

const svc = vi.hoisted(() => ({ getBucketMapViewport: vi.fn() }));
vi.mock('$lib/server/services/buckets.service', () => svc);

import { GET } from './+server';

const BUCKET = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const signedIn = { user: { id: 'u1' } };

function get(query: string, locals: unknown = signedIn, id = BUCKET) {
	return GET({
		params: { bucket_id: id },
		locals,
		url: new URL(`http://localhost/x?${query}`)
	} as never);
}

const full = 'west=-75.3&south=39.9&east=-75.1&north=40.1&zoom=12.5';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/buckets/[bucket_id]/location-map', () => {
	it('hands the viewport and zoom to the service', async () => {
		svc.getBucketMapViewport.mockResolvedValue({ points: [], clusters: [{ id: 'c' }] });

		const res = await get(full);

		expect(await res.json()).toEqual({ points: [], clusters: [{ id: 'c' }] });
		expect(svc.getBucketMapViewport).toHaveBeenCalledWith('u1', BUCKET, {
			west: -75.3,
			south: 39.9,
			east: -75.1,
			north: 40.1,
			zoom: 12.5
		});
	});

	it('answers 400 without a zoom, for a corner off the globe, or a malformed id', async () => {
		await expect(get('west=-75.3&south=39.9&east=-75.1&north=40.1')).rejects.toMatchObject({ status: 400 });
		await expect(get(full.replace('north=40.1', 'north=91'))).rejects.toMatchObject({ status: 400 });
		await expect(get(full, signedIn, 'x')).rejects.toMatchObject({ status: 400 });
		expect(svc.getBucketMapViewport).not.toHaveBeenCalled();
	});

	it('answers 401 when signed out', async () => {
		await expect(get(full, {})).rejects.toMatchObject({ status: 401 });
	});
});
