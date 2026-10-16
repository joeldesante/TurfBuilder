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

const { listBucketSurveys, createSurvey } = vi.hoisted(() => ({
	listBucketSurveys: vi.fn(),
	createSurvey: vi.fn()
}));

vi.mock('$lib/server/services/surveys.service', () => ({ listBucketSurveys, createSurvey }));

import { GET, POST } from './+server';

const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { bucket_id: BUCKET };
const signedIn = { user: { id: 'u1' } };

function post(body: unknown, locals: unknown = signedIn) {
	return POST({
		params,
		locals,
		request: new Request('http://localhost/api/v1/buckets/x/surveys', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/buckets/[bucket_id]/surveys', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed bucket id', async () => {
		await expect(
			GET({ params: { bucket_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the bucket's surveys", async () => {
		listBucketSurveys.mockResolvedValue([{ id: 's1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 's1' }]);
		expect(listBucketSurveys).toHaveBeenCalledWith('u1', BUCKET);
	});
});

describe('POST /api/v1/buckets/[bucket_id]/surveys', () => {
	it('answers 401 when signed out', async () => {
		await expect(post({ name: 'A' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 when the name is missing', async () => {
		await expect(post({ description: 'x' })).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 when the name is over 255 characters', async () => {
		await expect(post({ name: 'x'.repeat(256) })).rejects.toMatchObject({ status: 400 });
	});

	it('creates the survey and answers 201', async () => {
		createSurvey.mockResolvedValue({ id: 's1' });

		const res = await post({ name: ' Spring ' });

		expect(res.status).toBe(201);
		expect(createSurvey).toHaveBeenCalledWith('u1', BUCKET, { name: 'Spring' });
	});
});
