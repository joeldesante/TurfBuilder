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

const { getBucket, replaceBucket, updateBucket } = vi.hoisted(() => ({
	getBucket: vi.fn(),
	replaceBucket: vi.fn(),
	updateBucket: vi.fn()
}));

vi.mock('$lib/server/services/buckets.service', () => ({ getBucket, replaceBucket, updateBucket }));

import { GET, PUT, PATCH } from './+server';

const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { bucket_id: BUCKET };
const signedIn = { user: { id: 'u1' } };
const valid = { name: 'Voters', slug: 'voters', filter: { type: 'person' } };

function withBody(handler: typeof PUT, body: unknown, p = params, locals: unknown = signedIn) {
	return handler({
		params: p,
		locals,
		request: new Request('http://localhost/api/v1/buckets/x', {
			method: 'PUT',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/buckets/[bucket_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			GET({ params: { bucket_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the service's bucket", async () => {
		getBucket.mockResolvedValue({ id: BUCKET });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ id: BUCKET });
		expect(getBucket).toHaveBeenCalledWith('u1', BUCKET);
	});

	it('passes a service error through', async () => {
		getBucket.mockRejectedValue({ status: 404 });

		await expect(GET({ params, locals: signedIn } as never)).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('PUT /api/v1/buckets/[bucket_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(withBody(PUT, valid, params, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 when the filter is missing', async () => {
		await expect(withBody(PUT, { name: 'Voters', slug: 'voters' })).rejects.toMatchObject({
			status: 400
		});
	});

	it('replaces the bucket with the full body', async () => {
		replaceBucket.mockResolvedValue({ id: BUCKET });

		const res = await withBody(PUT, valid);

		expect(await res.json()).toEqual({ id: BUCKET });
		expect(replaceBucket).toHaveBeenCalledWith('u1', BUCKET, valid);
	});
});

describe('PATCH /api/v1/buckets/[bucket_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(withBody(PATCH, { name: 'A' }, params, {})).rejects.toMatchObject({
			status: 401
		});
	});

	it('answers 400 for an invalid slug', async () => {
		await expect(withBody(PATCH, { slug: 'Bad Slug' })).rejects.toMatchObject({ status: 400 });
	});

	it('updates only the given fields', async () => {
		updateBucket.mockResolvedValue({ id: BUCKET });

		await withBody(PATCH, { name: 'A' });

		expect(updateBucket).toHaveBeenCalledWith('u1', BUCKET, { name: 'A' });
	});
});
