import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ isSlugAvailable: vi.fn() }));
vi.mock('$lib/server/services/organizations.service', () => svc);

import { GET } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

function get(slug: string, locals: unknown = { user: { id: 'u1' } }) {
	return (GET as Handler)({ locals, params: { slug } } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /organization-slugs/[slug]', () => {
	it('answers 401 when signed out', async () => {
		await expect(get('acme', {})).rejects.toMatchObject({ status: 401 });
		expect(svc.isSlugAvailable).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed slug without asking the service', async () => {
		await expect(get('Not A Slug')).rejects.toMatchObject({ status: 400 });
		await expect(get('-leading-hyphen')).rejects.toMatchObject({ status: 400 });
		expect(svc.isSlugAvailable).not.toHaveBeenCalled();
	});

	it('says a free slug is available', async () => {
		svc.isSlugAvailable.mockResolvedValue(true);

		const res = await get('acme');

		expect(svc.isSlugAvailable).toHaveBeenCalledWith('acme');
		expect(await res.json()).toEqual({ available: true });
	});

	it('says a taken slug is not available', async () => {
		svc.isSlugAvailable.mockResolvedValue(false);

		const res = await get('acme');

		expect(await res.json()).toEqual({ available: false });
	});
});
