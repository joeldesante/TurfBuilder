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

const { listBuckets, createBucket } = vi.hoisted(() => ({
	listBuckets: vi.fn(),
	createBucket: vi.fn()
}));

vi.mock('$lib/server/services/buckets.service', () => ({ listBuckets, createBucket }));

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG };
const signedIn = { user: { id: 'u1' } };
const valid = { name: 'Voters', slug: 'voters', filter: { type: 'person' } };

function post(body: unknown, p = params, locals: unknown = signedIn) {
	return POST({
		params: p,
		locals,
		request: new Request('http://localhost/api/v1/organizations/x/buckets', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/organizations/[organization_id]/buckets', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed organization id', async () => {
		await expect(
			GET({ params: { organization_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the organization's buckets", async () => {
		listBuckets.mockResolvedValue([{ id: 'b1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 'b1' }]);
		expect(listBuckets).toHaveBeenCalledWith('u1', ORG);
	});
});

describe('POST /api/v1/organizations/[organization_id]/buckets', () => {
	it('answers 401 when signed out', async () => {
		await expect(post(valid, params, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed organization id', async () => {
		await expect(post(valid, { organization_id: 'nope' })).rejects.toMatchObject({
			status: 400
		});
	});

	it('answers 400 when the filter is missing', async () => {
		await expect(post({ name: 'Voters', slug: 'voters' })).rejects.toMatchObject({
			status: 400
		});
	});

	it('creates the bucket and answers 201', async () => {
		createBucket.mockResolvedValue({ id: 'b1', ...valid });

		const res = await post(valid);

		expect(res.status).toBe(201);
		expect(createBucket).toHaveBeenCalledWith('u1', ORG, valid);
	});
});
