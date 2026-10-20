import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mocks = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	client: { query: vi.fn() },
	requireInfraPermission: vi.fn(),
	audit: vi.fn(),
	recordEvent: vi.fn()
}));

vi.mock('$lib/server/database', () => ({
	POOL: mocks.pool,
	withOrgTransaction: vi.fn(async (_org: string, fn: (c: unknown) => unknown) => fn(mocks.client))
}));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: mocks.requireInfraPermission }));
vi.mock('./audit.service', () => ({ audit: mocks.audit, listAuditEventsFor: vi.fn() }));
vi.mock('./activity.service', () => ({ queryActivityPage: vi.fn(), recordEvent: mocks.recordEvent }));

import {
	deleteOrg,
	getOrg,
	listOrgs,
	queryOrgsPage,
	removeMember,
	suspendOrg,
	transferOwnership
} from './platform-organizations.service';

const ADMIN = 'u-admin';
const ORG = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const MEMBER = 'b1b2c3d4-e5f6-4890-abcd-ef1234567890';

const orgRow = {
	id: ORG,
	name: 'Riverside',
	slug: 'riverside',
	created_at: new Date('2026-01-01T00:00:00Z'),
	suspended_at: null,
	deleted_at: null,
	suspended_reason: null,
	member_count: '12',
	pending_invitations: '1',
	owner: { id: 'u1', name: 'Grace' },
	last_active_day: '2026-10-19',
	events_30d: '40'
};

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

function respond(overrides: (sql: string) => unknown = () => undefined) {
	const handler = (sql: string) => {
		const custom = overrides(sql);
		if (custom !== undefined) return Promise.resolve(custom);
		if (sql.includes('COUNT(*) AS count FROM auth.organization')) return Promise.resolve({ rows: [{ count: '1' }] });
		if (sql.includes('FROM auth.organization o')) return Promise.resolve({ rows: [orgRow], rowCount: 1 });
		return Promise.resolve({ rows: [], rowCount: 0 });
	};
	mocks.pool.query.mockImplementation(handler);
	mocks.client.query.mockImplementation(handler);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	respond();
});

describe('listing organizations', () => {
	it('requires access', async () => {
		await listOrgs(ADMIN, {}, 1);
		expect(mocks.requireInfraPermission).toHaveBeenCalledWith(ADMIN, 'access');
	});

	it('leaves deleted orgs out unless asked for', async () => {
		await queryOrgsPage({}, 1);
		expect(flat(mocks.pool.query.mock.calls[0][0])).toContain('WHERE o.deleted_at IS NULL');

		vi.clearAllMocks();
		respond();
		await queryOrgsPage({ status: 'deleted' }, 1);
		expect(flat(mocks.pool.query.mock.calls[0][0])).toContain('WHERE o.deleted_at IS NOT NULL');
	});

	it('maps rows to the shared shape', async () => {
		const page = await queryOrgsPage({}, 1);
		expect(page.items[0]).toMatchObject({ memberCount: 12, pendingInvitations: 1, events30d: 40, suspended: false });
	});
});

describe('getOrg', () => {
	it('reads universe counts inside the org', async () => {
		respond((sql) => {
			if (sql.includes('AS records')) return { rows: [{ records: '500', buckets: '2', lists: '3', turfs: '9', surveys: '1', visits: '80', visits_30d: '20', conversations: '30', documents: '4' }] };
			if (sql.includes('AS active')) return { rows: [{ active: '5', dormant: '4', never: '3', created_by: null }] };
			return undefined;
		});

		const org = await getOrg(ADMIN, ORG);

		expect(org.counts).toMatchObject({ members: 12, records: 500, visits30d: 20, documents: 4 });
		expect(org.memberActivity).toEqual({ active: 5, dormant: 4, never: 3 });
		expect(org.createdBy).toEqual({ id: 'u1', name: 'Grace' });
		expect(mocks.client.query.mock.calls.some((c) => flat(c[0]).includes('universe.turf_location_attempt'))).toBe(true);
	});

	it('answers 404 for an unknown org', async () => {
		respond((sql) => (sql.includes('WHERE o.id = $1') ? { rows: [] } : undefined));
		await expect(getOrg(ADMIN, ORG)).rejects.toMatchObject({ status: 404 });
	});
});

describe('changes', () => {
	it('suspending requires orgs.manage and is audited', async () => {
		await suspendOrg(ADMIN, ORG, 'Unpaid');
		expect(mocks.requireInfraPermission).toHaveBeenCalledWith(ADMIN, 'orgs.manage');
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'org.suspend', { type: 'organization', id: ORG }, {
			name: 'Riverside',
			reason: 'Unpaid'
		});
	});

	it('deleting needs the slug typed back and only marks the row', async () => {
		await expect(deleteOrg(ADMIN, ORG, 'wrong')).rejects.toMatchObject({ status: 400 });

		await deleteOrg(ADMIN, ORG, 'Riverside');
		const sqls = mocks.pool.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls).toContain('UPDATE auth.organization SET deleted_at = now() WHERE id = $1');
		expect(sqls.some((s) => s.startsWith('DELETE FROM auth.organization'))).toBe(false);
	});

	it('transferring ownership demotes the old owners and grants the admin role', async () => {
		respond((sql) => {
			if (sql.includes('SELECT m.user_id, m.role, u.name')) return { rows: [{ user_id: 'u2', role: 'member', name: 'Alan' }] };
			if (sql.includes("SET role = 'admin'")) return { rows: [{ user_id: 'u1' }] };
			if (sql.includes('FROM permission_role')) return { rows: [{ id: 'role-admin' }] };
			return undefined;
		});

		await transferOwnership(ADMIN, ORG, MEMBER);

		const sqls = mocks.client.query.mock.calls.map((c) => flat(c[0]));
		expect(sqls.some((s) => s.includes("UPDATE auth.member SET role = 'owner' WHERE id = $1"))).toBe(true);
		const grant = mocks.client.query.mock.calls.find((c) => flat(c[0]).startsWith('INSERT INTO user_role_membership'));
		expect(grant?.[1]).toEqual(['u2', MEMBER, 'role-admin', ADMIN]);
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'org.ownership.transfer', { type: 'organization', id: ORG }, expect.objectContaining({ newOwner: 'u2', previousOwners: ['u1'] }));
	});

	it('will not remove the only owner', async () => {
		respond((sql) => {
			if (sql.includes('FROM auth.member m JOIN auth.user u ON u.id = m.user_id WHERE m.id = $1')) {
				return { rows: [{ organization_id: ORG, user_id: 'u1', role: 'owner', name: 'Grace' }] };
			}
			if (sql.includes('COUNT(*) AS count FROM auth.member')) return { rows: [{ count: '1' }] };
			return undefined;
		});

		await expect(removeMember(ADMIN, MEMBER)).rejects.toMatchObject({ status: 409 });
		expect(mocks.recordEvent).not.toHaveBeenCalled();
	});

	it('removing a member records that they left', async () => {
		respond((sql) => {
			if (sql.includes('FROM auth.member m JOIN auth.user u ON u.id = m.user_id WHERE m.id = $1')) {
				return { rows: [{ organization_id: ORG, user_id: 'u3', role: 'member', name: 'Ada' }] };
			}
			if (sql.includes('COUNT(*) AS count FROM auth.member')) return { rows: [{ count: '1' }] };
			return undefined;
		});

		await removeMember(ADMIN, MEMBER);
		expect(mocks.recordEvent).toHaveBeenCalledWith('member.left', { userId: 'u3', orgId: ORG, metadata: { removedBy: ADMIN } });
	});
});
