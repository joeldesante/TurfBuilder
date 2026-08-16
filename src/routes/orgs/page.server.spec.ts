import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factory, which vitest lifts above this file's consts,
// can still reach it.
const { mockClient } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() }
}));

vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

import { load } from './+page.server';

const locals = {
	user: { id: 'u1', name: 'Alice' },
	organization: null
};

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.query.mockResolvedValue({ rows: [] });
});

describe('orgs page load', () => {
	it('returns allowCreation=true when the setting is enabled', async () => {
		mockClient.query.mockResolvedValue({ rows: [{ value: 'true' }] });

		const result = await load({ locals } as any);
		expect(result.allowCreation).toBe(true);
	});

	it('returns allowCreation=false when the setting is missing', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await load({ locals } as any);
		expect(result.allowCreation).toBe(false);
	});

	it('releases the db client', async () => {
		await load({ locals } as any);
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
