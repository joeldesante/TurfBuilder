import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

const filters = (people: unknown, locations: unknown) => ({ v: 2, people, locations });
const group = { operator: 'AND', filters: [] };

/** The page the bucket opens on, from the redirect it throws. */
async function opensOn(bucketFilters: unknown) {
	try {
		await load({
			parent: async () => ({ bucket: { slug: 'voters', filters: bucketFilters } }),
			params: { org_slug: 'acme' }
		} as never);
	} catch (e) {
		const redirect = e as { status: number; location: string };
		return { status: redirect.status, location: redirect.location };
	}
	throw new Error('expected a redirect');
}

describe('a bucket opens on its first section', () => {
	const base = '/o/acme/s/universe/buckets/voters';

	it('is Locations when it includes locations', async () => {
		expect(await opensOn(filters(group, group))).toEqual({ status: 307, location: `${base}/locations` });
	});

	it('is People when it includes only people', async () => {
		expect((await opensOn(filters(group, null))).location).toBe(`${base}/people`);
	});

	it('is Scripts when it includes neither', async () => {
		expect((await opensOn(filters(null, null))).location).toBe(`${base}/scripts`);
	});

	it('is Filters when its old filters could not be converted, so it can be rebuilt', async () => {
		expect((await opensOn(null)).location).toBe(`${base}/filters`);
	});
});
