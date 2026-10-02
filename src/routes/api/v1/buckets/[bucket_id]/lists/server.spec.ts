import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const { listBucketLists } = vi.hoisted(() => ({
	listBucketLists: vi.fn()
}));

vi.mock('$lib/server/services/lists.service', () => ({ listBucketLists }));

import { GET } from './+server';

const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { bucket_id: BUCKET };
const signedIn = { user: { id: 'u1' } };

describe('GET /api/v1/buckets/[bucket_id]/lists', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed bucket id', async () => {
		await expect(
			GET({ params: { bucket_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the bucket's lists", async () => {
		listBucketLists.mockResolvedValue([{ id: 'l1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 'l1' }]);
		expect(listBucketLists).toHaveBeenCalledWith('u1', BUCKET);
	});
});
