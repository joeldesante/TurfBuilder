import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listOrgs } = vi.hoisted(() => ({ listOrgs: vi.fn() }));
vi.mock('$lib/server/services/platform-organizations.service', () => ({ listOrgs }));
vi.mock('$lib/server/services/organizations.service', () => ({ createOrganization: vi.fn() }));

import { GET } from './+server';

beforeEach(() => {
	vi.clearAllMocks();
	listOrgs.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 });
});

describe('GET /api/v1/organizations', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ locals: {}, url: new URL('http://x') } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('passes the filters and page to the service', async () => {
		await GET({
			locals: { user: { id: 'u1' } },
			url: new URL('http://x?q=river&status=inactive&sort=members&page=2')
		} as never);
		expect(listOrgs).toHaveBeenCalledWith('u1', { q: 'river', status: 'inactive', sort: 'members' }, 2);
	});
});
