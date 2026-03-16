import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock('pg', () => ({
	Pool: vi.fn(() => ({
		connect: vi.fn().mockResolvedValue(mockClient),
		on: vi.fn(),
		end: vi.fn()
	}))
}));

import { load } from './+page.server';

const authenticatedLocals = {
	user: { id: 'u1', name: 'Alice' },
	organization: null
};

const unauthenticatedLocals = {
	user: null,
	organization: null
};

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.query.mockResolvedValue({ rows: [] });
});

describe('orgs page load', () => {
	it('redirects unauthenticated users', async () => {
		await expect(load({ locals: unauthenticatedLocals } as any)).rejects.toMatchObject({
			status: 303,
			location: '/auth/signin'
		});
	});

	it('returns orgs array for authenticated user', async () => {
		const orgs = [
			{ id: 'org-1', name: 'My Org', slug: 'my-org' }
		];
		mockClient.query.mockResolvedValue({ rows: orgs });

		const result = await load({ locals: authenticatedLocals } as any);
		expect(result.orgs).toEqual(orgs);
	});

	it('returns empty orgs array when user has no memberships', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await load({ locals: authenticatedLocals } as any);
		expect(result.orgs).toEqual([]);
	});

	it('queries with the user id', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		await load({ locals: authenticatedLocals } as any);

		expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), ['u1']);
	});

	it('releases the db client', async () => {
		await load({ locals: authenticatedLocals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
