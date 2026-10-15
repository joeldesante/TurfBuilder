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

const { listBucketLists, createBucketList } = vi.hoisted(() => ({
	listBucketLists: vi.fn(),
	createBucketList: vi.fn()
}));

vi.mock('$lib/server/services/lists.service', () => ({ listBucketLists, createBucketList }));

import { GET, POST } from './+server';

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

describe('POST /api/v1/buckets/[bucket_id]/lists', () => {
	const valid = { name: 'Doors', entity_type: 'locations', expires_at: '2027-01-01T00:00:00.000Z' };

	function post(body: unknown, p: Record<string, string> = params, locals: unknown = signedIn) {
		return POST({
			params: p,
			locals,
			request: new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
		} as never);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		createBucketList.mockResolvedValue({ id: 'l1' });
	});

	it('answers 401 when signed out', async () => {
		await expect(post(valid, params, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed bucket id', async () => {
		await expect(post(valid, { bucket_id: 'nope' })).rejects.toMatchObject({ status: 400 });
	});

	it.each([
		['no name', { ...valid, name: ' ' }],
		['an unknown entity type', { ...valid, entity_type: 'pets' }],
		['an expiry that is not a date', { ...valid, expires_at: 'tomorrow' }],
		['an incomplete filter', { ...valid, filters: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: '' }] } }],
		['the old filter form', { ...valid, filters: { matchType: 'ALL', conditions: [] } }]
	])('answers 400 for %s, creating nothing', async (_name, body) => {
		await expect(post(body)).rejects.toMatchObject({ status: 400 });
		expect(createBucketList).not.toHaveBeenCalled();
	});

	it('creates the list and answers 201 with its id', async () => {
		const res = await post(valid);

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ id: 'l1' });
		expect(createBucketList).toHaveBeenCalledWith('u1', BUCKET, valid);
	});

	it('passes the list filters on', async () => {
		const filters = { operator: 'AND', filters: [{ item: 'zip_code', operation: 'starts_with', value: '787' }] };

		await post({ ...valid, filters });

		expect(createBucketList).toHaveBeenCalledWith('u1', BUCKET, { ...valid, filters });
	});

	it('passes a service error through', async () => {
		createBucketList.mockRejectedValue({ status: 422 });

		await expect(post(valid)).rejects.toMatchObject({ status: 422 });
	});
});
