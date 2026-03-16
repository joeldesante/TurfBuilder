import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg and env before importing database-dependent modules
vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mockClient = {
	query: vi.fn(),
	release: vi.fn()
};

vi.mock('pg', () => ({
	Pool: vi.fn(() => ({
		connect: vi.fn().mockResolvedValue(mockClient),
		on: vi.fn(),
		end: vi.fn()
	}))
}));

vi.mock('$plugins/registry', () => ({
	PLUGIN_REGISTRY: new Map([
		['plugin-a', { slug: 'plugin-a', name: 'Plugin A', version: '1.0.0' }],
		['plugin-b', { slug: 'plugin-b', name: 'Plugin B', version: '1.0.0' }]
	])
}));

import { getActivePlugins } from './plugins';

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.release.mockReset();
});

describe('getActivePlugins', () => {
	it('returns installed plugins found in the registry', async () => {
		mockClient.query.mockResolvedValue({
			rows: [
				{ plugin_slug: 'plugin-a', config: { key: 'value' } }
			]
		});

		const result = await getActivePlugins('org-123');

		expect(result).toHaveLength(1);
		expect(result[0].manifest.slug).toBe('plugin-a');
		expect(result[0].config).toEqual({ key: 'value' });
	});

	it('excludes plugins not found in the registry', async () => {
		mockClient.query.mockResolvedValue({
			rows: [
				{ plugin_slug: 'unknown-plugin', config: {} }
			]
		});

		const result = await getActivePlugins('org-123');
		expect(result).toHaveLength(0);
	});

	it('returns multiple plugins when multiple are installed', async () => {
		mockClient.query.mockResolvedValue({
			rows: [
				{ plugin_slug: 'plugin-a', config: {} },
				{ plugin_slug: 'plugin-b', config: {} }
			]
		});

		const result = await getActivePlugins('org-123');
		expect(result).toHaveLength(2);
	});

	it('returns empty array when no plugins are installed', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		const result = await getActivePlugins('org-123');
		expect(result).toHaveLength(0);
	});

	it('queries with the correct orgId parameter', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		await getActivePlugins('org-abc-123');

		expect(mockClient.query).toHaveBeenCalledWith(
			expect.stringContaining('plugin_installation'),
			['org-abc-123']
		);
	});

	it('releases the db client after the query', async () => {
		mockClient.query.mockResolvedValue({ rows: [] });

		await getActivePlugins('org-123');

		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});

	it('releases the db client even when the query throws', async () => {
		mockClient.query.mockRejectedValue(new Error('DB error'));

		await expect(getActivePlugins('org-123')).rejects.toThrow('DB error');
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});
});
