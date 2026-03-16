import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database and plugins modules before importing hooks
vi.mock('$lib/server/database', () => ({
	withOrgTransaction: vi.fn((orgId: string, fn: (client: unknown) => Promise<unknown>) =>
		fn({ query: vi.fn() })
	)
}));

vi.mock('$lib/server/plugins', () => ({
	getActivePlugins: vi.fn()
}));

import { fireHook } from './hooks';
import { getActivePlugins } from './plugins';

const mockGetActivePlugins = vi.mocked(getActivePlugins);

const orgId = 'org-123';
const userId = 'user-456';
const userRole = { id: 'role-1', is_owner: false, is_default: true, permissions: [] } as any;

beforeEach(() => {
	vi.clearAllMocks();
});

describe('fireHook', () => {
	it('does nothing when no plugins are active', async () => {
		mockGetActivePlugins.mockResolvedValue([]);
		await expect(fireHook('onSurveySubmitted', orgId, userId, userRole)).resolves.toBeUndefined();
	});

	it('calls the matching hook on each active plugin', async () => {
		const hook = vi.fn().mockResolvedValue(undefined);
		mockGetActivePlugins.mockResolvedValue([
			{
				manifest: { slug: 'test', name: 'Test', version: '1.0.0', hooks: { onSurveySubmitted: hook } } as any,
				config: {}
			}
		]);

		await fireHook('onSurveySubmitted', orgId, userId, userRole);

		expect(hook).toHaveBeenCalledTimes(1);
	});

	it('skips plugins that have no matching hook', async () => {
		const hook = vi.fn().mockResolvedValue(undefined);
		mockGetActivePlugins.mockResolvedValue([
			{
				manifest: { slug: 'test', name: 'Test', version: '1.0.0', hooks: { onTurfCreated: hook } } as any,
				config: {}
			}
		]);

		// Fire onSurveySubmitted — plugin only has onTurfCreated
		await fireHook('onSurveySubmitted', orgId, userId, userRole);

		expect(hook).not.toHaveBeenCalled();
	});

	it('swallows errors from individual plugins and continues', async () => {
		const failingHook = vi.fn().mockRejectedValue(new Error('Plugin crashed'));
		const passingHook = vi.fn().mockResolvedValue(undefined);
		mockGetActivePlugins.mockResolvedValue([
			{
				manifest: { slug: 'bad', name: 'Bad', version: '1.0.0', hooks: { onSurveySubmitted: failingHook } } as any,
				config: {}
			},
			{
				manifest: { slug: 'good', name: 'Good', version: '1.0.0', hooks: { onSurveySubmitted: passingHook } } as any,
				config: {}
			}
		]);

		// Should not throw even though one plugin failed
		await expect(fireHook('onSurveySubmitted', orgId, userId, userRole)).resolves.toBeUndefined();
		expect(passingHook).toHaveBeenCalled();
	});

	it('passes a plugin context with orgId, userId, and userRole', async () => {
		const hook = vi.fn().mockResolvedValue(undefined);
		mockGetActivePlugins.mockResolvedValue([
			{
				manifest: { slug: 'test', name: 'Test', version: '1.0.0', hooks: { onSurveySubmitted: hook } } as any,
				config: { apiKey: 'secret' }
			}
		]);

		await fireHook('onSurveySubmitted', orgId, userId, userRole);

		const ctx = hook.mock.calls[0][0];
		expect(ctx.orgId).toBe(orgId);
		expect(ctx.userId).toBe(userId);
		expect(ctx.userRole).toBe(userRole);
		expect(ctx.config).toEqual({ apiKey: 'secret' });
		expect(typeof ctx.db).toBe('function');
	});

	it('calls hooks on multiple plugins', async () => {
		const hook1 = vi.fn().mockResolvedValue(undefined);
		const hook2 = vi.fn().mockResolvedValue(undefined);
		mockGetActivePlugins.mockResolvedValue([
			{
				manifest: { slug: 'p1', name: 'P1', version: '1.0.0', hooks: { onSurveySubmitted: hook1 } } as any,
				config: {}
			},
			{
				manifest: { slug: 'p2', name: 'P2', version: '1.0.0', hooks: { onSurveySubmitted: hook2 } } as any,
				config: {}
			}
		]);

		await fireHook('onSurveySubmitted', orgId, userId, userRole);

		expect(hook1).toHaveBeenCalledTimes(1);
		expect(hook2).toHaveBeenCalledTimes(1);
	});
});
