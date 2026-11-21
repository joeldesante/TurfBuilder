import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: mockClient.query,
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ROLE = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const role = {
	id: ROLE,
	organization_id: ORG,
	name: 'Canvasser',
	is_default: false,
	weight: 500,
	permissions: []
};

import {
	listRoles,
	listRoleOptions,
	getRole,
	createRole,
	renameRole,
	deleteRole,
	replaceRolePermissions
} from './roles.service';

/**
 * Answers the caller's membership, the role-in-org lookup, and everything else
 * with `rest`. `found` false makes the role unknown in the caller's orgs.
 */
function stub(
	rest: (sql: string, values?: unknown[]) => unknown = () => ({ rowCount: 1, rows: [role] }),
	found = true
) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('JOIN auth.organization o ON o.id = m.organization_id')) {
			return Promise.resolve({
				rowCount: 1,
				rows: [{ organization_id: ORG, role: 'member', suspended: false, deleted: false }]
			});
		}
		if (sql.startsWith('SELECT 1 FROM permission_role')) {
			return Promise.resolve(found ? { rowCount: 1, rows: [{}] } : { rowCount: 0, rows: [] });
		}
		return Promise.resolve(rest(sql, values));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

const writes = /INSERT INTO permission|UPDATE permission|DELETE FROM permission/;

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('every operation', () => {
	it.each([
		['listRoles', 'role.read', () => listRoles('u1', ORG)],
		['listRoleOptions', 'member.read', () => listRoleOptions('u1', ORG)],
		['getRole', 'role.read', () => getRole('u1', ROLE)],
		['createRole', 'role.create', () => createRole('u1', ORG, { name: 'A' })],
		['renameRole', 'role.update', () => renameRole('u1', ROLE, 'A')],
		['deleteRole', 'role.delete', () => deleteRole('u1', ROLE)],
		['replaceRolePermissions', 'role.update', () => replaceRolePermissions('u1', ROLE, [])]
	])('%s needs %s and changes nothing without it', async (_name, key, run) => {
		canOrg.mockImplementation(async (_c: unknown, _u: string, _o: string, k: string) => k !== key);

		await expect(run()).rejects.toMatchObject({ status: 403 });

		const sql = mockClient.query.mock.calls.map((c) => String(c[0])).join('\n');
		expect(sql).not.toMatch(writes);
	});

	it.each([
		['getRole', () => getRole('u1', ROLE)],
		['renameRole', () => renameRole('u1', ROLE, 'A')],
		['deleteRole', () => deleteRole('u1', ROLE)],
		['replaceRolePermissions', () => replaceRolePermissions('u1', ROLE, [])]
	])("%s answers 404 for a role in none of the caller's orgs", async (_name, run) => {
		stub(undefined, false);

		await expect(run()).rejects.toMatchObject({ status: 404 });
	});
});

describe('createRole', () => {
	it('creates an organization role at the default weight that grants nothing', async () => {
		stub(() => ({
			rowCount: 1,
			rows: [{ id: ROLE, organization_id: ORG, name: 'Canvasser', is_default: false, weight: 500 }]
		}));

		const created = await createRole('u1', ORG, { name: 'Canvasser' });

		expect(sqlRun('INSERT INTO permission_role')![1]).toEqual(['Canvasser', 500, ORG]);
		expect(created.permissions).toEqual([]);
	});
});

describe('renameRole', () => {
	it('answers 409 for the default role', async () => {
		stub((sql) =>
			sql.includes('UPDATE permission_role')
				? { rowCount: 1, rows: [{ is_default: true }] }
				: { rowCount: 1, rows: [role] }
		);

		await expect(renameRole('u1', ROLE, 'Anyone')).rejects.toMatchObject({ status: 409 });
	});
});

describe('deleteRole', () => {
	it('answers 409 for the default role and deletes nothing', async () => {
		stub(() => ({ rowCount: 1, rows: [{ is_default: true }] }));

		await expect(deleteRole('u1', ROLE)).rejects.toMatchObject({ status: 409 });
		expect(sqlRun('DELETE FROM permission_role')).toBeUndefined();
	});

	it('deletes a role within the org', async () => {
		stub(() => ({ rowCount: 1, rows: [{ is_default: false }] }));

		await deleteRole('u1', ROLE);

		expect(sqlRun('DELETE FROM permission_role WHERE')![1]).toEqual([ROLE, ORG]);
	});
});

describe('replaceRolePermissions', () => {
	it('answers 400 for an unknown key before reading anything', async () => {
		await expect(replaceRolePermissions('u1', ROLE, ['nope.nothing'])).rejects.toMatchObject({
			status: 400
		});
		expect(mockClient.query).not.toHaveBeenCalled();
	});

	it('replaces the entries with exactly the keys given', async () => {
		stub((sql) =>
			sql.includes('SELECT weight')
				? { rowCount: 1, rows: [{ weight: 500 }] }
				: { rowCount: 1, rows: [role] }
		);

		await replaceRolePermissions('u1', ROLE, ['canvass.use']);

		expect(sqlRun('DELETE FROM permission_role_entry')![1]).toEqual([ROLE]);
		expect(sqlRun('INSERT INTO permission_role_entry')![1]).toEqual([ROLE, ['canvass.use']]);
	});

	it('keeps system.access on the administrator role', async () => {
		stub((sql) =>
			sql.includes('SELECT weight')
				? { rowCount: 1, rows: [{ weight: 0 }] }
				: { rowCount: 1, rows: [role] }
		);

		await replaceRolePermissions('u1', ROLE, ['canvass.use']);

		expect(sqlRun('INSERT INTO permission_role_entry')![1]).toEqual([
			ROLE,
			['canvass.use', 'system.access']
		]);
	});

	it('inserts nothing when a plain role is left with no keys', async () => {
		stub((sql) =>
			sql.includes('SELECT weight')
				? { rowCount: 1, rows: [{ weight: 500 }] }
				: { rowCount: 1, rows: [role] }
		);

		await replaceRolePermissions('u1', ROLE, []);

		expect(sqlRun('INSERT INTO permission_role_entry')).toBeUndefined();
	});
});
