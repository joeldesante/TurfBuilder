import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	svelteKitHandler: vi.fn(async () => new Response('ok')),
	pool: { query: vi.fn() },
	client: { query: vi.fn() },
	resolveOrgPermissions: vi.fn(async () => ['canvass.use']),
	resolveInfraPermissions: vi.fn(async () => [] as string[]),
	touchActiveDay: vi.fn(),
	audit: vi.fn(async () => undefined)
}));

vi.mock('$app/environment', () => ({ building: false }));
vi.mock('$lib/auth', () => ({ getAuth: async () => ({ api: { getSession: mocks.getSession } }) }));
vi.mock('better-auth/svelte-kit', () => ({ svelteKitHandler: mocks.svelteKitHandler }));
vi.mock('$lib/server/database', () => ({
	POOL: mocks.pool,
	withOrgTransaction: async (_org: string, fn: (c: unknown) => unknown) => fn(mocks.client)
}));
vi.mock('$lib/server/permissions', () => ({
	resolveOrgPermissions: mocks.resolveOrgPermissions,
	resolveInfraPermissions: mocks.resolveInfraPermissions
}));
vi.mock('$lib/server/setup', () => ({ isSetupComplete: async () => true }));
vi.mock('$lib/server/settings', () => ({
	getAllSettings: async () => ({
		app: {},
		observability: {
			analytics: { provider: 'none', posthogHost: '', posthogToken: '' },
			telemetry: { tracesEndpoint: '', logsEndpoint: '' }
		}
	}),
	SettingsMissingError: class extends Error {}
}));
vi.mock('$lib/server/analytics', () => ({
	analytics: { capture: vi.fn(), captureException: vi.fn() },
	configureAnalytics: vi.fn(async () => {})
}));
vi.mock('$lib/server/telemetry', () => ({ applyTelemetry: vi.fn() }));
vi.mock('$lib/server/services/activity.service', () => ({ touchActiveDay: mocks.touchActiveDay }));
vi.mock('$lib/server/services/audit.service', () => ({ audit: mocks.audit }));
vi.mock('$lib/server/runtime-metrics', () => ({ startRuntimeMetrics: vi.fn() }));

import { handle } from './hooks.server';
import { logger } from '$lib/server/logger';

const USER = { id: 'u1', email: 'grace@example.org', name: 'Grace' };
const ADMIN = 'admin-1';
const ORG = { id: 'org-1', name: 'Riverside', slug: 'riverside', suspended_at: null as Date | null };

function signedIn(impersonatedBy: string | null = null) {
	mocks.getSession.mockResolvedValue({ user: USER, session: { id: 's1', impersonatedBy } });
}

function call(path: string, method = 'GET') {
	const event = {
		url: new URL(`http://x${path}`),
		request: new Request(`http://x${path}`, { method }),
		locals: {} as App.Locals
	};
	const run = handle({ event, resolve: vi.fn() } as never);
	return { event, run };
}

beforeEach(() => {
	vi.clearAllMocks();
	signedIn();
	mocks.resolveInfraPermissions.mockResolvedValue([]);
	mocks.pool.query.mockResolvedValue({ rows: [ORG] });
	mocks.client.query.mockResolvedValue({ rowCount: 1, rows: [] });
});

describe('impersonation', () => {
	it('strips infra permissions without resolving them', async () => {
		signedIn(ADMIN);
		const { event, run } = call('/orgs');
		await run;

		expect(mocks.resolveInfraPermissions).not.toHaveBeenCalled();
		expect(event.locals.infrastructure?.permissions).toEqual([]);
		expect(event.locals.impersonatedBy).toBe(ADMIN);
	});

	it('closes the infra panel', async () => {
		signedIn(ADMIN);

		await expect(call('/infra/users').run).rejects.toMatchObject({ status: 403 });
		expect(mocks.svelteKitHandler).not.toHaveBeenCalled();
	});

	it('audits changes made while impersonating, against the admin', async () => {
		signedIn(ADMIN);
		await call('/api/v1/lists', 'POST').run;

		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'impersonation.request', { type: 'user', id: USER.id }, {
			method: 'POST',
			path: '/api/v1/lists'
		});
	});

	it('does not audit reads', async () => {
		signedIn(ADMIN);
		await call('/orgs').run;

		expect(mocks.audit).not.toHaveBeenCalled();
	});

	it('still answers when the audit write fails', async () => {
		signedIn(ADMIN);
		mocks.audit.mockRejectedValueOnce(new Error('db down'));

		const response = await call('/api/v1/lists', 'POST').run;
		expect(response.status).toBe(200);
	});

	it('does not count the admin’s browsing as the user being active', async () => {
		signedIn(ADMIN);
		await call('/orgs').run;

		expect(mocks.touchActiveDay).not.toHaveBeenCalled();
	});
});

describe('an ordinary session', () => {
	it('resolves infra permissions and marks the user active', async () => {
		await call('/orgs').run;

		expect(mocks.resolveInfraPermissions).toHaveBeenCalledWith(USER.id);
		expect(mocks.touchActiveDay).toHaveBeenCalledWith(USER.id, undefined);
	});
});

describe('organization status', () => {
	it('treats a deleted org as missing', async () => {
		await call('/o/riverside/map').run;

		expect(String(mocks.pool.query.mock.calls[0][0])).toContain('deleted_at IS NULL');
	});

	it('answers 403 to a member of a suspended org', async () => {
		mocks.pool.query.mockResolvedValue({ rows: [{ ...ORG, suspended_at: new Date() }] });

		await expect(call('/o/riverside/map').run).rejects.toMatchObject({ status: 403 });
		expect(mocks.svelteKitHandler).not.toHaveBeenCalled();
	});

	it('lets an infra admin look at a suspended org', async () => {
		mocks.resolveInfraPermissions.mockResolvedValue(['access']);
		mocks.pool.query.mockResolvedValue({ rows: [{ ...ORG, suspended_at: new Date() }] });

		const response = await call('/o/riverside/map').run;
		expect(response.status).toBe(200);
	});

	it('closes a suspended org to an impersonating admin too', async () => {
		signedIn(ADMIN);
		mocks.pool.query.mockResolvedValue({ rows: [{ ...ORG, suspended_at: new Date() }] });

		await expect(call('/o/riverside/map').run).rejects.toMatchObject({ status: 403 });
	});
});

describe('access log', () => {
	it('logs the route pattern, never the URL, which can hold tokens and slugs', async () => {
		const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
		const event = {
			url: new URL('http://x/invite/secret-token-123'),
			request: new Request('http://x/invite/secret-token-123'),
			route: { id: '/invite/[token]' },
			locals: {} as App.Locals
		};

		await handle({ event, resolve: vi.fn() } as never);

		const logged = info.mock.calls.find(([, message]) => message === 'request');
		expect(logged?.[0]).toMatchObject({ method: 'GET', route: '/invite/[token]', status: 200 });
		expect(JSON.stringify(logged)).not.toContain('secret-token-123');
	});
});
