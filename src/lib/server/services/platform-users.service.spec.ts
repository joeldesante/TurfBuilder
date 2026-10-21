import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mocks = vi.hoisted(() => ({
	pool: { query: vi.fn(), connect: vi.fn() },
	client: { query: vi.fn(), release: vi.fn() },
	requireInfraPermission: vi.fn(),
	canInfra: vi.fn(),
	audit: vi.fn(),
	lockAdminChanges: vi.fn(),
	requireAnAdminLeft: vi.fn(),
	requireNotStronger: vi.fn(),
	isMailConfigured: vi.fn(),
	requestPasswordReset: vi.fn(),
	sendVerificationEmail: vi.fn()
}));

vi.mock('$lib/server/database', () => ({
	POOL: mocks.pool,
	withOrgTransaction: vi.fn(async (_org: string, fn: (c: unknown) => unknown) => fn(mocks.client)),
	// Plain transactions run on the pool mock, so query assertions read one place.
	withTransaction: vi.fn(async (fn: (c: unknown) => unknown) => fn(mocks.pool))
}));
vi.mock('$lib/server/permissions', () => ({
	requireInfraPermission: mocks.requireInfraPermission,
	canInfra: mocks.canInfra
}));
vi.mock('$lib/server/mail', () => ({ isMailConfigured: mocks.isMailConfigured }));
vi.mock('$lib/auth', () => ({
	getAuth: async () => ({
		api: { requestPasswordReset: mocks.requestPasswordReset, sendVerificationEmail: mocks.sendVerificationEmail }
	})
}));
vi.mock('./audit.service', () => ({ audit: mocks.audit, listAuditEventsFor: vi.fn() }));
vi.mock('./activity.service', () => ({ queryActivityPage: vi.fn() }));
vi.mock('./email-log.service', () => ({ queryEmailLogPage: vi.fn() }));
vi.mock('./infra-admins.service', () => ({
	lockAdminChanges: mocks.lockAdminChanges,
	requireAnAdminLeft: mocks.requireAnAdminLeft,
	requireNotStronger: mocks.requireNotStronger
}));

import {
	deleteUser,
	getUser,
	listUsers,
	queryUsersPage,
	revokeUserSessions,
	sendPasswordReset,
	suspendUser,
	updateUser
} from './platform-users.service';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

const userRow = {
	id: TARGET,
	name: 'Grace',
	email: 'grace@example.com',
	username: 'grace',
	image: null,
	email_verified: true,
	two_factor_enabled: false,
	suspended: false,
	created_at: new Date('2026-01-02T00:00:00Z'),
	last_active_day: '2026-10-01',
	org_count: '2',
	is_infra_admin: false,
	display_username: 'Grace',
	updated_at: new Date('2026-02-01T00:00:00Z'),
	ban_reason: null,
	ban_expires: null,
	deleted_at: null,
	sign_in_methods: [{ providerId: 'credential', createdAt: '2026-01-02T00:00:00Z' }],
	infra_roles: null,
	active_sessions: '1'
};

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

function respond(overrides: (sql: string) => unknown = () => undefined) {
	const handler = (sql: string) => {
		const custom = overrides(sql);
		if (custom !== undefined) return custom instanceof Promise ? custom : Promise.resolve(custom);
		if (sql.includes('COUNT(*) AS count FROM auth.user')) return Promise.resolve({ rows: [{ count: '1' }] });
		if (sql.includes('FROM auth.user u')) return Promise.resolve({ rows: [userRow], rowCount: 1 });
		return Promise.resolve({ rows: [], rowCount: 0 });
	};
	mocks.pool.query.mockImplementation(handler);
	mocks.client.query.mockImplementation(handler);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	mocks.canInfra.mockResolvedValue(false);
	mocks.lockAdminChanges.mockResolvedValue(undefined);
	mocks.requireAnAdminLeft.mockResolvedValue(undefined);
	mocks.requireNotStronger.mockResolvedValue(undefined);
	mocks.isMailConfigured.mockResolvedValue(true);
	mocks.pool.connect.mockResolvedValue(mocks.client);
	respond();
});

describe('listing users', () => {
	it('requires access', async () => {
		await listUsers(ADMIN, {}, 1);
		expect(mocks.requireInfraPermission).toHaveBeenCalledWith(ADMIN, 'access');
	});

	it('picks the page first, then computes the costly columns for that page only', async () => {
		await queryUsersPage({ sort: 'recently_active' }, 1);

		const page = mocks.pool.query.mock.calls.map((c) => flat(c[0])).find((q) => q.startsWith('WITH p AS'))!;
		const inner = page.slice(0, page.indexOf(') SELECT'));
		expect(inner).toContain('AS sort_key');
		expect(inner).toContain('LIMIT $1 OFFSET $2');
		expect(inner).not.toContain('auth.member');
		expect(page).toContain('FROM p JOIN auth.user u ON u.id = p.id');
	});

	it('maps rows to the shared shape', async () => {
		const page = await queryUsersPage({}, 1);
		expect(page.items[0]).toMatchObject({ id: TARGET, orgCount: 2, lastActiveDay: '2026-10-01', isInfraAdmin: false });
	});

	it('searches name, email, and username with LIKE wildcards escaped', async () => {
		await queryUsersPage({ q: '50%_off' }, 1);
		const [sql, params] = mocks.pool.query.mock.calls[0];
		expect(flat(sql)).toContain('lower(u.email) LIKE $1 OR lower(u.name) LIKE $1 OR lower(u.username) LIKE $1');
		expect(params[0]).toBe('%50\\%\\_off%');
	});

	it('hides deleted accounts', async () => {
		await queryUsersPage({}, 1);
		expect(flat(mocks.pool.query.mock.calls[0][0])).toContain('u.deleted_at IS NULL');
	});

	it('filters by status', async () => {
		await queryUsersPage({ status: 'no_orgs' }, 1);
		expect(flat(mocks.pool.query.mock.calls[0][0])).toContain(
			'NOT EXISTS (SELECT 1 FROM auth.member m WHERE m.user_id = u.id)'
		);
	});
});

describe('getUser', () => {
	it('answers 404 for an unknown user', async () => {
		respond((sql) => (sql.includes('WHERE u.id = $1') ? { rows: [], rowCount: 0 } : undefined));
		await expect(getUser(ADMIN, TARGET)).rejects.toMatchObject({ status: 404 });
	});

	it('includes sign-in methods and session count', async () => {
		const user = await getUser(ADMIN, TARGET);
		expect(user).toMatchObject({
			signInMethods: [{ providerId: 'credential' }],
			activeSessionCount: 1,
			deleted: false
		});
	});
});

describe('updateUser', () => {
	it('requires users.manage', async () => {
		await updateUser(ADMIN, TARGET, { name: 'Grace H' });
		expect(mocks.requireInfraPermission).toHaveBeenCalledWith(ADMIN, 'users.manage');
	});

	it('marks a new email unverified and records what changed', async () => {
		await updateUser(ADMIN, TARGET, { email: 'new@example.com' });

		const update = mocks.pool.query.mock.calls.find((c) => flat(c[0]).startsWith('UPDATE auth.user SET'));
		expect(flat(update?.[0])).toContain('email = $1, email_verified = $2');
		expect(update?.[1]).toEqual(['new@example.com', false, TARGET]);
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'user.update', { type: 'user', id: TARGET }, {
			changes: {
				email: { from: 'grace@example.com', to: 'new@example.com' },
				emailVerified: { from: true, to: false }
			}
		}, mocks.pool);
	});

	it('answers 409 for a taken email', async () => {
		respond((sql) =>
			sql.startsWith('UPDATE auth.user SET')
				? Promise.reject(Object.assign(new Error('dup'), { code: '23505', constraint: 'user_email_unique' }))
				: undefined
		);
		await expect(updateUser(ADMIN, TARGET, { email: 'taken@example.com' })).rejects.toMatchObject({ status: 409 });
	});

	it('changes nothing when nothing differs', async () => {
		await updateUser(ADMIN, TARGET, { name: 'Grace' });
		expect(mocks.audit).not.toHaveBeenCalled();
	});
});

describe('sendPasswordReset', () => {
	it('goes through the normal reset flow and is audited', async () => {
		await sendPasswordReset(ADMIN, TARGET);
		expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
			body: { email: 'grace@example.com', redirectTo: '/auth/reset-password' }
		});
		expect(mocks.audit).toHaveBeenCalledWith(
			ADMIN,
			'user.password_reset.send',
			{ type: 'user', id: TARGET },
			expect.anything()
		);
	});

	it('answers 409 when mail is not set up', async () => {
		mocks.isMailConfigured.mockResolvedValue(false);
		await expect(sendPasswordReset(ADMIN, TARGET)).rejects.toMatchObject({ status: 409 });
		expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
	});
});

describe('changes to a stronger admin', () => {
	// users.manage alone must not let an admin change the email of, reset, or
	// sign out someone holding infra permissions they lack.
	const refused = Object.assign(new Error('stronger'), { status: 403 });

	it.each([
		['updateUser', () => updateUser(ADMIN, TARGET, { email: 'mine@example.com' })],
		['sendPasswordReset', () => sendPasswordReset(ADMIN, TARGET)],
		['revokeUserSessions', () => revokeUserSessions(ADMIN, TARGET)],
		['deleteUser', () => deleteUser(ADMIN, TARGET, 'grace@example.com')]
	])('%s is refused and changes nothing', async (_name, call) => {
		mocks.requireNotStronger.mockRejectedValue(refused);

		await expect(call()).rejects.toMatchObject({ status: 403 });
		expect(mocks.requireNotStronger).toHaveBeenCalledWith(ADMIN, TARGET);
		const writes = mocks.pool.query.mock.calls.filter((c) => /^(UPDATE|DELETE)/.test(flat(c[0])));
		expect(writes).toEqual([]);
		expect(mocks.client.query).not.toHaveBeenCalled();
		expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
		expect(mocks.audit).not.toHaveBeenCalled();
	});
});

describe('suspendUser', () => {
	it('bans the user and ends their sessions in one transaction', async () => {
		await suspendUser(ADMIN, TARGET, { reason: 'Spam' });

		const sqls = mocks.client.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls[0]).toBe('BEGIN');
		expect(sqls.some((s) => s.includes('SET banned = true'))).toBe(true);
		expect(sqls.some((s) => s.startsWith('DELETE FROM auth.session'))).toBe(true);
		expect(sqls.at(-1)).toBe('COMMIT');
	});

	it('refuses yourself and infra admins', async () => {
		await expect(suspendUser(ADMIN, ADMIN, { reason: 'x' })).rejects.toMatchObject({ status: 400 });
		mocks.canInfra.mockResolvedValue(true);
		await expect(suspendUser(ADMIN, TARGET, { reason: 'x' })).rejects.toMatchObject({ status: 409 });
	});
});

describe('revokeUserSessions', () => {
	it('can keep the caller session', async () => {
		await revokeUserSessions(ADMIN, TARGET, '33333333-3333-4333-8333-333333333333');
		const del = mocks.pool.query.mock.calls.find((c) => flat(c[0]).startsWith('DELETE FROM auth.session'));
		expect(del?.[1]).toEqual([TARGET, '33333333-3333-4333-8333-333333333333']);
	});
});

describe('deleteUser', () => {
	it('needs the email typed back', async () => {
		await expect(deleteUser(ADMIN, TARGET, 'wrong@example.com')).rejects.toMatchObject({ status: 400 });
	});

	it('refuses the only owner of an org, checked under a lock in the delete transaction', async () => {
		respond((sql) => (sql.includes("'owner' = ANY") && !sql.includes('FOR UPDATE') ? { rows: [{ id: 'o1', name: 'Riverside' }] } : undefined));
		await expect(deleteUser(ADMIN, TARGET, 'grace@example.com')).rejects.toMatchObject({ status: 409 });

		const sqls = mocks.client.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls[0]).toBe('BEGIN');
		expect(sqls.some((s) => s.includes('FOR UPDATE'))).toBe(true);
		expect(sqls).toContain('ROLLBACK');
	});

	it('guards the last admin inside the delete, under the admin lock, and rolls back', async () => {
		mocks.canInfra.mockResolvedValue(true);
		mocks.requireAnAdminLeft.mockRejectedValue(Object.assign(new Error('last'), { status: 409 }));

		await expect(deleteUser(ADMIN, TARGET, 'grace@example.com')).rejects.toMatchObject({ status: 409 });
		expect(mocks.lockAdminChanges).toHaveBeenCalledWith(mocks.client);
		expect(mocks.requireAnAdminLeft).toHaveBeenCalledWith(mocks.client, expect.any(String));
		const sqls = mocks.client.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls).toContain('ROLLBACK');
		expect(sqls).not.toContain('COMMIT');
		expect(mocks.audit).not.toHaveBeenCalled();
	});

	it('anonymizes rather than deleting the row', async () => {
		await deleteUser(ADMIN, TARGET, 'GRACE@example.com');

		const sqls = mocks.client.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls.some((s) => s.startsWith('DELETE FROM auth.user'))).toBe(false);
		expect(sqls.some((s) => s.includes("name = 'Deleted user'"))).toBe(true);
		expect(sqls.some((s) => s.startsWith('DELETE FROM auth.account'))).toBe(true);
		expect(sqls.some((s) => s.startsWith('DELETE FROM auth.member'))).toBe(true);
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'user.delete', { type: 'user', id: TARGET }, expect.anything(), mocks.client);
	});
});
