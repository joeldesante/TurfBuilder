import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listUsers } = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock('$lib/server/services/platform-users.service', () => ({ listUsers }));

import { GET } from './+server';

const page = { items: [], totalCount: 0, page: 1, pageSize: 100 };

beforeEach(() => {
	vi.clearAllMocks();
	listUsers.mockResolvedValue(page);
});

describe('GET /api/v1/users', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ locals: {}, url: new URL('http://x/api/v1/users') } as never)).rejects.toMatchObject({
			status: 401
		});
	});

	it('passes the filters and page to the service', async () => {
		const res = await GET({
			locals: { user: { id: 'u1' } },
			url: new URL('http://x/api/v1/users?q=ada&status=suspended&sort=name&page=3')
		} as never);

		expect(listUsers).toHaveBeenCalledWith('u1', { q: 'ada', status: 'suspended', sort: 'name' }, 3);
		expect(await res.json()).toEqual(page);
	});

	it('drops malformed filters instead of failing', async () => {
		await GET({ locals: { user: { id: 'u1' } }, url: new URL('http://x/api/v1/users?status=bogus&sort=x') } as never);
		expect(listUsers).toHaveBeenCalledWith('u1', { q: undefined, status: undefined, sort: undefined }, 0);
	});
});
