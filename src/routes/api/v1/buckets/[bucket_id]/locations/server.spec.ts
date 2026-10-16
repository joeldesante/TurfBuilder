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

const { listBucketLocations } = vi.hoisted(() => ({ listBucketLocations: vi.fn() }));

vi.mock('$lib/server/services/buckets.service', () => ({ listBucketLocations }));

import { GET } from './+server';

const ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { bucket_id: ID };
const signedIn = { user: { id: 'u1' } };

function get(query = '', p: Record<string, string> = params, locals: unknown = signedIn) {
	return GET({ params: p, locals, url: new URL(`http://localhost/api/v1/x${query}`) } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/buckets/[bucket_id]/locations', () => {
	it('answers 401 when signed out', async () => {
		await expect(get('', params, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(get('', { bucket_id: 'nope' })).rejects.toMatchObject({ status: 400 });
	});

	it('returns the page the service finds', async () => {
		const page = { items: [{ id: 'x' }], totalCount: 1, page: 1, pageSize: 100 };
		listBucketLocations.mockResolvedValue(page);

		const res = await get();

		expect(await res.json()).toEqual(page);
	});

	it('passes ?page= to the service', async () => {
		listBucketLocations.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 });

		await get('?page=3');

		expect(listBucketLocations).toHaveBeenCalledWith('u1', ID, 3);
	});

	it('leaves a missing page for the service to clamp', async () => {
		listBucketLocations.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 });

		await get();

		expect(listBucketLocations).toHaveBeenCalledWith('u1', ID, 0);
	});

	it('passes a service error through', async () => {
		listBucketLocations.mockRejectedValue({ status: 403 });

		await expect(get()).rejects.toMatchObject({ status: 403 });
	});
});
