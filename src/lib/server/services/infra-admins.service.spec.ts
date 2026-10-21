import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } }));

const mocks = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn(),
	resolveInfraPermissions: vi.fn(),
	audit: vi.fn()
}));

vi.mock('$lib/server/database', () => ({
	POOL: mocks.pool,
	withTransaction: async (fn: (c: unknown) => unknown) => fn(mocks.pool)
}));
vi.mock('$lib/server/permissions', () => ({
	requireInfraPermission: mocks.requireInfraPermission,
	resolveInfraPermissions: mocks.resolveInfraPermissions
}));
vi.mock('./audit.service', () => ({ audit: mocks.audit }));

import { grantInfraRole, requireNotStronger, revokeInfraRole } from './infra-admins.service';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const ROLE = '33333333-3333-4333-8333-333333333333';

/** Gives each user these infra permissions. */
function holds(byUser: Record<string, string[]>) {
	mocks.resolveInfraPermissions.mockImplementation(async (id: string) => byUser[id] ?? []);
}

/** The role grants `rolePerms`; every other query finds a row. */
function stubPool(rolePerms: string[]) {
	mocks.pool.query.mockImplementation(async (sql: string) => {
		if (sql.includes('FROM permission_role_entry pre')) return { rows: rolePerms.map((key) => ({ key })) };
		if (sql.includes('SELECT name FROM permission_role')) return { rowCount: 1, rows: [{ name: 'Support' }] };
		if (sql.includes('SELECT pr.name FROM user_role_membership')) return { rowCount: 1, rows: [{ name: 'Support' }] };
		if (sql.includes('SELECT urm.user_id')) return { rows: [{ user_id: ACTOR }] };
		return { rowCount: 1, rows: [{}] };
	});
}

const writes = () => mocks.pool.query.mock.calls.filter((c) => /^\s*(INSERT|DELETE)/.test(String(c[0])));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
});

describe('requireNotStronger', () => {
	it('allows acting on someone with the same or fewer permissions', async () => {
		holds({ [ACTOR]: ['access', 'users.manage'], [TARGET]: ['access'] });

		await expect(requireNotStronger(ACTOR, TARGET)).resolves.toBeUndefined();
	});

	it('refuses someone holding a permission the actor lacks', async () => {
		holds({ [ACTOR]: ['access', 'users.manage'], [TARGET]: ['access', 'settings.manage'] });

		await expect(requireNotStronger(ACTOR, TARGET)).rejects.toMatchObject({ status: 403 });
	});

	it('lets anyone with users.manage act on an ordinary user', async () => {
		holds({ [ACTOR]: ['access', 'users.manage'] });

		await expect(requireNotStronger(ACTOR, TARGET)).resolves.toBeUndefined();
	});
});

describe('grantInfraRole', () => {
	it('refuses a role with a permission the giver lacks, including to themselves', async () => {
		holds({ [ACTOR]: ['access', 'users.manage'] });
		stubPool(['access', 'users.manage', 'settings.manage']);

		await expect(grantInfraRole(ACTOR, ACTOR, ROLE)).rejects.toMatchObject({ status: 403 });
		expect(writes()).toEqual([]);
		expect(mocks.audit).not.toHaveBeenCalled();
	});

	it('grants a role within the giver’s permissions', async () => {
		holds({ [ACTOR]: ['access', 'users.manage', 'audit.read'] });
		stubPool(['access', 'audit.read']);

		await grantInfraRole(ACTOR, TARGET, ROLE);

		expect(writes()).toHaveLength(1);
		expect(mocks.audit).toHaveBeenCalledWith(ACTOR, 'infra_role.grant', { type: 'user', id: TARGET }, expect.anything(), mocks.pool);
	});
});

describe('revokeInfraRole', () => {
	it('refuses to take a role from a stronger admin', async () => {
		holds({ [ACTOR]: ['access', 'users.manage'], [TARGET]: ['access', 'users.manage', 'settings.manage'] });
		stubPool([]);

		await expect(revokeInfraRole(ACTOR, TARGET, ROLE)).rejects.toMatchObject({ status: 403 });
		expect(writes()).toEqual([]);
	});

	it('removes the role under the admin lock and refuses when no admin who can manage users is left', async () => {
		holds({ [ACTOR]: ['access', 'users.manage'], [TARGET]: ['access', 'users.manage'] });
		stubPool([]);
		// After the delete, nobody resolves to an admin who can manage users.
		mocks.resolveInfraPermissions.mockImplementation(async (id: string, db?: unknown) =>
			db ? [] : ['access', 'users.manage']
		);

		await expect(revokeInfraRole(ACTOR, TARGET, ROLE)).rejects.toMatchObject({ status: 409 });

		const sqls = mocks.pool.query.mock.calls.map((c) => String(c[0]));
		const lock = sqls.findIndex((q) => q.includes('pg_advisory_xact_lock'));
		const remove = sqls.findIndex((q) => q.startsWith('DELETE FROM user_role_membership'));
		expect(lock).toBeGreaterThanOrEqual(0);
		expect(remove).toBeGreaterThan(lock);
		expect(mocks.audit).not.toHaveBeenCalled();
	});
});
