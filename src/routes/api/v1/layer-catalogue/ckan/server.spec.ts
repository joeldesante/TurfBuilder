import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	searchCkanPortal: vi.fn(async () => ({ entries: [], hasMore: false, next: null }))
}));
vi.mock('$lib/server/services/layer-catalogue.service', () => svc);

import { GET } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

const event = (query: string, signedIn = true) => ({
	locals: signedIn ? { user: { id: 'u1' } } : {},
	url: new URL(`https://example.test/api/v1/layer-catalogue/ckan${query}`)
});

beforeEach(() => vi.clearAllMocks());

describe('GET /layer-catalogue/ckan', () => {
	it('answers 401 when signed out', async () => {
		await expect((GET as Handler)(event('?portal=boston', false) as never)).rejects.toMatchObject({ status: 401 });
		expect(svc.searchCkanPortal).not.toHaveBeenCalled();
	});

	it('passes the portal, search text and start to the service', async () => {
		const res = await (GET as Handler)(event('?portal=boston&q=wards&start=20') as never);

		expect(svc.searchCkanPortal).toHaveBeenCalledWith('boston', 'wards', 20);
		expect(res.status).toBe(200);
	});

	it('starts at the first page with no search text', async () => {
		await (GET as Handler)(event('?portal=toronto') as never);

		expect(svc.searchCkanPortal).toHaveBeenCalledWith('toronto', '', 0);
	});

	it('answers 400 for a missing or unknown portal, so no address can be supplied', async () => {
		await expect((GET as Handler)(event('') as never)).rejects.toMatchObject({ status: 400 });
		await expect(
			(GET as Handler)(event('?portal=https://evil.example') as never)
		).rejects.toMatchObject({ status: 400 });
		expect(svc.searchCkanPortal).not.toHaveBeenCalled();
	});

	it('answers 400 for a bad start', async () => {
		await expect((GET as Handler)(event('?portal=boston&start=-5') as never)).rejects.toMatchObject({ status: 400 });
	});
});
