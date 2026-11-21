import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const m = vi.hoisted(() => ({
	client: { query: vi.fn() },
	requireOrgPermission: vi.fn(async () => undefined),
	requireRequestOrganization: vi.fn(),
	getActivePlugins: vi.fn(),
	handler: vi.fn(async () => new Response('ok'))
}));

vi.mock('$lib/server/database', () => ({
	withOrgTransaction: async (_org: string, fn: (c: unknown) => unknown) => fn(m.client)
}));
vi.mock('$lib/server/list-access', () => ({ requireOrgPermission: m.requireOrgPermission }));
vi.mock('$lib/server/plugins', () => ({ getActivePlugins: m.getActivePlugins }));
vi.mock('$lib/server/services/request-organization.service', () => ({
	requireRequestOrganization: m.requireRequestOrganization
}));
vi.mock('$plugins/registry', () => {
	const plugin = {
		slug: 'feed',
		name: 'Feed',
		description: '',
		version: '1.0.0',
		configSchema: z.object({ url: z.url() }),
		apiHandlers: { 'GET:status': m.handler }
	};
	return { getPlugin: (slug: string) => (slug === 'feed' ? plugin : undefined) };
});

import {
	installPlugin,
	uninstallPlugin,
	replacePluginConfig,
	runPluginApi
} from './plugin-installations.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const event = {} as never;

beforeEach(() => {
	vi.clearAllMocks();
	m.client.query.mockResolvedValue({ rowCount: 1, rows: [] });
	m.requireOrgPermission.mockResolvedValue(undefined);
	m.requireRequestOrganization.mockResolvedValue({ id: ORG, role: { id: 'r1', name: 'Staff' } });
	m.getActivePlugins.mockResolvedValue([
		{ manifest: { slug: 'feed' }, config: { url: 'https://x' } }
	]);
});

describe('installing and uninstalling', () => {
	it.each([
		['installPlugin', () => installPlugin('u1', ORG, 'nope')],
		['uninstallPlugin', () => uninstallPlugin('u1', ORG, 'nope')],
		['replacePluginConfig', () => replacePluginConfig('u1', ORG, 'nope', {})]
	])('%s answers 404 for a plugin not in the registry', async (_name, run) => {
		await expect(run()).rejects.toMatchObject({ status: 404 });
		expect(m.client.query).not.toHaveBeenCalled();
	});

	it('checks plugin.manage before writing', async () => {
		m.requireOrgPermission.mockRejectedValue(
			Object.assign(new Error('Forbidden'), { status: 403 })
		);

		await expect(installPlugin('u1', ORG, 'feed')).rejects.toMatchObject({ status: 403 });
		expect(m.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'plugin.manage');
		expect(m.client.query).not.toHaveBeenCalled();
	});

	it('installs or re-enables the plugin for the org', async () => {
		await installPlugin('u1', ORG, 'feed');

		const [sql, values] = m.client.query.mock.calls[0];
		expect(sql).toContain('ON CONFLICT (organization_id, plugin_slug)');
		expect(values).toEqual([ORG, 'feed', 'u1']);
	});

	it('only disables on uninstall, keeping the config', async () => {
		await uninstallPlugin('u1', ORG, 'feed');

		const [sql] = m.client.query.mock.calls[0];
		expect(sql).toContain('SET enabled = false');
		expect(sql).not.toContain('config');
	});
});

describe('replacePluginConfig', () => {
	it("answers 400 for a config that fails the plugin's schema and saves nothing", async () => {
		await expect(
			replacePluginConfig('u1', ORG, 'feed', { url: 'not a url' })
		).rejects.toMatchObject({
			status: 400
		});
		expect(m.client.query).not.toHaveBeenCalled();
	});

	it('answers 404 when the plugin was never installed', async () => {
		m.client.query.mockResolvedValue({ rowCount: 0, rows: [] });

		await expect(
			replacePluginConfig('u1', ORG, 'feed', { url: 'https://x' })
		).rejects.toMatchObject({
			status: 404
		});
	});

	it('saves the checked config', async () => {
		await replacePluginConfig('u1', ORG, 'feed', { url: 'https://x' });

		expect(m.client.query.mock.calls[0][1]).toEqual([ORG, 'feed', '{"url":"https://x"}']);
	});
});

describe('runPluginApi', () => {
	it('answers 403 for a member without a staff role', async () => {
		m.requireRequestOrganization.mockResolvedValue({ id: ORG, role: undefined });

		await expect(runPluginApi('u1', ORG, 'feed', 'GET', 'status', event)).rejects.toMatchObject({
			status: 403
		});
		expect(m.handler).not.toHaveBeenCalled();
	});

	it('answers 404 when the plugin is not active in the org', async () => {
		m.getActivePlugins.mockResolvedValue([]);

		await expect(runPluginApi('u1', ORG, 'feed', 'GET', 'status', event)).rejects.toMatchObject({
			status: 404
		});
	});

	it('answers 404 for a method and path without a handler', async () => {
		await expect(runPluginApi('u1', ORG, 'feed', 'POST', 'status', event)).rejects.toMatchObject({
			status: 404
		});
	});

	it('runs the handler with a context that carries no database handle', async () => {
		const res = await runPluginApi('u1', ORG, 'feed', 'GET', 'status', event);

		expect(await res.text()).toBe('ok');
		expect(m.handler).toHaveBeenCalledWith(event, {
			orgId: ORG,
			userId: 'u1',
			userRole: { id: 'r1', name: 'Staff' },
			config: { url: 'https://x' }
		});
	});
});
