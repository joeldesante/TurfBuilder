import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } }));

const mocks = vi.hoisted(() => ({
	canInfra: vi.fn(),
	deleteSessionCookie: vi.fn(),
	setSessionCookie: vi.fn()
}));

vi.mock('$lib/server/permissions', () => ({ canInfra: mocks.canInfra }));
vi.mock('better-auth/cookies', () => ({
	deleteSessionCookie: mocks.deleteSessionCookie,
	setSessionCookie: mocks.setSessionCookie
}));

import { impersonateHandler, IMPERSONATION_SECONDS } from './infra-impersonation-plugin';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

/** Who holds which infra permissions. */
function perms(byUser: Record<string, string[]>) {
	mocks.canInfra.mockImplementation(async (id: string, key: string) => (byUser[id] ?? []).includes(key));
}

function context(overrides: { impersonatedBy?: string | null; userId?: string; target?: object | null } = {}) {
	const createSession = vi.fn(async (_userId: string, _dont: boolean, extra: { expiresAt: Date }) => ({
		id: 'new-session',
		token: 'new-token',
		expiresAt: extra.expiresAt
	}));
	const ctx = {
		body: { userId: overrides.userId ?? TARGET },
		context: {
			session: { user: { id: ADMIN }, session: { token: 'admin-token', impersonatedBy: overrides.impersonatedBy ?? null } },
			internalAdapter: {
				findUserById: vi.fn(async () => (overrides.target === undefined ? { id: TARGET, name: 'Grace' } : overrides.target)),
				createSession
			},
			authCookies: { dontRememberToken: { name: 'dont_remember' }, sessionToken: { attributes: { httpOnly: true } } },
			createAuthCookie: vi.fn((name: string) => ({ name: `ba.${name}` })),
			secret: 'secret'
		},
		getSignedCookie: vi.fn(async () => null),
		setSignedCookie: vi.fn(async () => undefined),
		json: vi.fn((value: unknown) => value)
	};
	return { ctx, createSession };
}

async function run(ctx: ReturnType<typeof context>['ctx']) {
	return impersonateHandler(ctx as unknown as Parameters<typeof impersonateHandler>[0]);
}

beforeEach(() => {
	vi.clearAllMocks();
	perms({ [ADMIN]: ['access', 'users.impersonate'] });
});

describe('impersonateHandler', () => {
	it('starts a one-hour session for the target, marked with the admin, keeping the admin session to restore', async () => {
		const { ctx, createSession } = context();
		const before = Date.now();

		await run(ctx);

		const [userId, , extra] = createSession.mock.calls[0];
		expect(userId).toBe(TARGET);
		expect(extra).toMatchObject({ impersonatedBy: ADMIN });
		const lasts = (extra as { expiresAt: Date }).expiresAt.getTime() - before;
		expect(lasts).toBeGreaterThan((IMPERSONATION_SECONDS - 5) * 1000);
		expect(lasts).toBeLessThanOrEqual(IMPERSONATION_SECONDS * 1000 + 1000);

		expect(ctx.setSignedCookie).toHaveBeenCalledWith('ba.admin_session', 'admin-token:', 'secret', { httpOnly: true });
		expect(mocks.deleteSessionCookie).toHaveBeenCalled();
		expect(mocks.setSessionCookie).toHaveBeenCalledWith(ctx, expect.objectContaining({ user: { id: TARGET, name: 'Grace' } }), true);
	});

	it('refuses an admin without users.impersonate', async () => {
		perms({ [ADMIN]: ['access', 'users.manage'] });
		const { ctx, createSession } = context();

		await expect(run(ctx)).rejects.toMatchObject({ statusCode: 403 });
		expect(createSession).not.toHaveBeenCalled();
	});

	it('refuses to start while already impersonating', async () => {
		const { ctx, createSession } = context({ impersonatedBy: 'someone' });

		await expect(run(ctx)).rejects.toMatchObject({ statusCode: 403 });
		expect(createSession).not.toHaveBeenCalled();
	});

	it('refuses yourself', async () => {
		const { ctx, createSession } = context({ userId: ADMIN });

		await expect(run(ctx)).rejects.toMatchObject({ statusCode: 400 });
		expect(createSession).not.toHaveBeenCalled();
	});

	it('refuses an infrastructure admin as the target', async () => {
		perms({ [ADMIN]: ['access', 'users.impersonate'], [TARGET]: ['access'] });
		const { ctx, createSession } = context();

		await expect(run(ctx)).rejects.toMatchObject({ statusCode: 403 });
		expect(createSession).not.toHaveBeenCalled();
	});

	it('answers 404 for an unknown user', async () => {
		const { ctx, createSession } = context({ target: null });

		await expect(run(ctx)).rejects.toMatchObject({ statusCode: 404 });
		expect(createSession).not.toHaveBeenCalled();
	});

	it('leaves the cookies alone when it refuses', async () => {
		perms({});
		const { ctx } = context();

		await expect(run(ctx)).rejects.toBeTruthy();
		expect(mocks.deleteSessionCookie).not.toHaveBeenCalled();
		expect(ctx.setSignedCookie).not.toHaveBeenCalled();
		expect(mocks.setSessionCookie).not.toHaveBeenCalled();
	});
});
