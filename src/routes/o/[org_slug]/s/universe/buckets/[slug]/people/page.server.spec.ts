import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listBucketPeople } = vi.hoisted(() => ({ listBucketPeople: vi.fn() }));
vi.mock('$lib/server/services/buckets.service', () => ({ listBucketPeople }));

import { load } from './+page.server';

const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';

const event = (bucket: unknown) =>
	({
		parent: async () => ({ bucket }),
		locals: { user: { id: 'u1' }, organization: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
		url: new URL('https://x/o/acme/s/universe/buckets/voters/people?page=2')
	}) as never;

beforeEach(() => vi.clearAllMocks());

describe('the bucket people page', () => {
	it("answers 422 with the reason when the bucket's old filters could not be converted", async () => {
		await expect(
			load(event({ id: BUCKET, filters: null, problem: 'could not be converted' }))
		).rejects.toMatchObject({
			status: 422,
			body: { message: 'could not be converted' }
		});
	});

	it('is empty and disabled when the bucket does not include people', async () => {
		const filters = { v: 2, people: null, locations: null };

		expect(await load(event({ id: BUCKET, filters, problem: null }))).toMatchObject({
			enabled: false,
			totalCount: 0,
			people: []
		});
		expect(listBucketPeople).not.toHaveBeenCalled();
	});

	it("lists the requested page of the bucket's people", async () => {
		listBucketPeople.mockResolvedValue({
			items: [{ id: 'p1' }],
			totalCount: 101,
			page: 2,
			pageSize: 100
		});
		const filters = { v: 2, people: { operator: 'AND', filters: [] }, locations: null };

		expect(await load(event({ id: BUCKET, filters, problem: null }))).toMatchObject({
			enabled: true,
			people: [{ id: 'p1' }],
			totalCount: 101,
			page: 2
		});
		expect(listBucketPeople).toHaveBeenCalledWith('u1', BUCKET, 2);
	});
});
