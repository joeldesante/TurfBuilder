import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	searchDataGov: vi.fn(async () => ({ entries: [], hasMore: false, next: null }))
}));
vi.mock('$lib/server/services/layer-catalogue.service', () => svc);

import { GET } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

const event = (query: string, signedIn = true) => ({
	locals: signedIn ? { user: { id: 'u1' } } : {},
	url: new URL(`https://example.test/api/v1/layer-catalogue/data-gov${query}`)
});

beforeEach(() => vi.clearAllMocks());

describe('GET /layer-catalogue/data-gov', () => {
	it('answers 401 when signed out', async () => {
		await expect((GET as Handler)(event('', false) as never)).rejects.toMatchObject({ status: 401 });
		expect(svc.searchDataGov).not.toHaveBeenCalled();
	});

	it('passes the search text and cursor to the service', async () => {
		const res = await (GET as Handler)(event('?q=wards&after=abc') as never);

		expect(svc.searchDataGov).toHaveBeenCalledWith('wards', 'abc', false);
		expect(res.status).toBe(200);
	});

	it('browses with no search text', async () => {
		await (GET as Handler)(event('') as never);

		expect(svc.searchDataGov).toHaveBeenCalledWith('', undefined, false);
	});

	it('limits to government publishers when asked', async () => {
		await (GET as Handler)(event('?q=wards&official=1') as never);

		expect(svc.searchDataGov).toHaveBeenCalledWith('wards', undefined, true);
	});

	it('answers 400 for a search that is too long', async () => {
		await expect((GET as Handler)(event(`?q=${'x'.repeat(300)}`) as never)).rejects.toMatchObject({
			status: 400
		});
	});
});
