import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

import { load } from './+page.server';

const event = (bucket: unknown) =>
	({
		parent: async () => ({ bucket }),
		locals: { organization: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
		url: new URL('https://x/o/acme/s/universe/buckets/voters/locations')
	}) as never;

describe('the bucket locations page', () => {
	it('answers 422 with the reason when the bucket\'s old filters could not be converted', async () => {
		await expect(load(event({ filters: null, problem: 'could not be converted' }))).rejects.toMatchObject({
			status: 422,
			body: { message: 'could not be converted' }
		});
	});

	it('is empty and disabled when the bucket does not include locations', async () => {
		const filters = { v: 2, people: null, locations: null };

		expect(await load(event({ filters, problem: null }))).toMatchObject({
			enabled: false,
			totalCount: 0,
			locations: []
		});
	});
});
