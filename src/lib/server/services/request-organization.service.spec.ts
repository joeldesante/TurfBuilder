import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	client: { query: vi.fn() },
	resolveOrgPermissions: vi.fn(async () => ['canvass.use'])
}));

vi.mock('$lib/server/database', () => ({
	POOL: m.pool,
	withOrgTransaction: async (_org: string, fn: (c: unknown) => unknown) => fn(m.client)
}));
vi.mock('$lib/server/permissions', () => ({ resolveOrgPermissions: m.resolveOrgPermissions }));

import {
	resolveRequestOrganization,
	requireRequestOrganization
} from './request-organization.service';

const ORG = {
	id: 'org-1',
	name: 'Riverside',
	slug: 'riverside',
	suspended_at: null as Date | null
};

/** The member check answers `member`, the role lookup `role`. */
function membership(
	member = true,
	role: { id: string; name: string } | null = { id: 'r1', name: 'Staff' }
) {
	m.client.query.mockImplementation(async (sql: string) =>
		sql.includes('FROM auth.member')
			? { rowCount: member ? 1 : 0, rows: [] }
			: { rowCount: role ? 1 : 0, rows: role ? [role] : [] }
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	m.pool.query.mockResolvedValue({ rows: [ORG] });
	membership();
});

describe('resolveRequestOrganization', () => {
	it('returns the org with the caller role and permissions', async () => {
		expect(await resolveRequestOrganization('u1', 'riverside', { infraAccess: false })).toEqual({
			id: 'org-1',
			name: 'Riverside',
			slug: 'riverside',
			role: { id: 'r1', name: 'Staff' },
			permissions: ['canvass.use']
		});
	});

	it('leaves the role out for a member who holds none', async () => {
		membership(true, null);

		const org = await resolveRequestOrganization('u1', 'riverside', { infraAccess: false });

		expect(org?.role).toBeUndefined();
	});

	it('returns null for an unknown or deleted slug and for a non-member', async () => {
		m.pool.query.mockResolvedValueOnce({ rows: [] });
		expect(await resolveRequestOrganization('u1', 'gone', { infraAccess: false })).toBeNull();
		expect(m.pool.query.mock.calls[0][0]).toContain('deleted_at IS NULL');

		membership(false);
		expect(await resolveRequestOrganization('u1', 'riverside', { infraAccess: false })).toBeNull();
	});

	it('answers 403 for a suspended org unless an infra admin is looking', async () => {
		m.pool.query.mockResolvedValue({ rows: [{ ...ORG, suspended_at: new Date() }] });

		await expect(
			resolveRequestOrganization('u1', 'riverside', { infraAccess: false })
		).rejects.toMatchObject({
			status: 403
		});
		expect(
			await resolveRequestOrganization('u1', 'riverside', { infraAccess: true })
		).not.toBeNull();
	});
});

describe('requireRequestOrganization', () => {
	it('answers 404 for an unknown org or a non-member, and 403 for a suspended one', async () => {
		m.pool.query.mockResolvedValueOnce({ rows: [] });
		await expect(requireRequestOrganization('u1', 'org-1')).rejects.toMatchObject({ status: 404 });

		membership(false);
		await expect(requireRequestOrganization('u1', 'org-1')).rejects.toMatchObject({ status: 404 });

		m.pool.query.mockResolvedValueOnce({ rows: [{ ...ORG, suspended_at: new Date() }] });
		await expect(requireRequestOrganization('u1', 'org-1')).rejects.toMatchObject({ status: 403 });
	});

	it('returns the org for a member', async () => {
		expect(await requireRequestOrganization('u1', 'org-1')).toMatchObject({
			id: 'org-1',
			role: { id: 'r1' }
		});
	});
});
