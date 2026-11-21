import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const svc = vi.hoisted(() => ({
	installPlugin: vi.fn(),
	uninstallPlugin: vi.fn(),
	replacePluginConfig: vi.fn(),
	runPluginApi: vi.fn(async () => new Response('from plugin'))
}));
vi.mock('$lib/server/services/plugin-installations.service', () => svc);

import { PUT, DELETE } from './+server';
import { PUT as putConfig } from './config/+server';
import { GET as apiGet, POST as apiPost } from './api/[...path]/+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG, slug: 'feed' };
const signedIn = { user: { id: 'u1' } };

function config(body: string) {
	return putConfig({
		params,
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'PUT', body })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/organizations/[organization_id]/plugins/[slug]', () => {
	it('answers 401 when signed out and 400 for a malformed organization id', async () => {
		await expect(PUT({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			PUT({ params: { ...params, organization_id: 'x' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('installs with PUT and uninstalls with DELETE', async () => {
		expect((await PUT({ params, locals: signedIn } as never)).status).toBe(204);
		expect((await DELETE({ params, locals: signedIn } as never)).status).toBe(204);

		expect(svc.installPlugin).toHaveBeenCalledWith('u1', ORG, 'feed');
		expect(svc.uninstallPlugin).toHaveBeenCalledWith('u1', ORG, 'feed');
	});
});

describe('PUT .../plugins/[slug]/config', () => {
	it('answers 400 for a body that is not a JSON object', async () => {
		await expect(config('[1]')).rejects.toMatchObject({ status: 400 });
		await expect(config('nope')).rejects.toMatchObject({ status: 400 });
		expect(svc.replacePluginConfig).not.toHaveBeenCalled();
	});

	it('hands the config to the service', async () => {
		expect((await config('{"url":"https://x"}')).status).toBe(204);
		expect(svc.replacePluginConfig).toHaveBeenCalledWith('u1', ORG, 'feed', { url: 'https://x' });
	});
});

describe('.../plugins/[slug]/api/[...path]', () => {
	it('answers 401 when signed out', async () => {
		await expect(
			apiGet({ params: { ...params, path: 'status' }, locals: {} } as never)
		).rejects.toMatchObject({
			status: 401
		});
	});

	it('passes the method and path to the plugin and answers with its response', async () => {
		const event = { params: { ...params, path: 'feeds/1' }, locals: signedIn };

		const res = await apiPost(event as never);

		expect(await res.text()).toBe('from plugin');
		expect(svc.runPluginApi).toHaveBeenCalledWith('u1', ORG, 'feed', 'POST', 'feeds/1', event);
	});
});
