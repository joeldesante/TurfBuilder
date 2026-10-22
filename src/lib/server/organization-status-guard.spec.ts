import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } }));

const pool = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/server/database', () => ({ POOL: pool }));

import { organizationStatusFor } from './organization-status-guard';

const ORG = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

function org(row: { deleted?: boolean; suspended?: boolean } | null) {
	pool.query.mockResolvedValue({ rows: row ? [{ deleted: false, suspended: false, ...row }] : [] });
}

beforeEach(() => vi.clearAllMocks());

describe('organizationStatusFor', () => {
	it('reads the org named by id', async () => {
		org({ suspended: true });

		expect(await organizationStatusFor({ path: '/organization/invite-member', body: { organizationId: ORG } }, null)).toBe('suspended');
		expect(pool.query.mock.calls[0][1]).toEqual([ORG]);
	});

	it('reads the org named by slug', async () => {
		org({ deleted: true });

		expect(await organizationStatusFor({ path: '/organization/get-full-organization', query: { organizationSlug: 'acme' } }, null)).toBe('deleted');
		expect(String(pool.query.mock.calls[0][0])).toContain('o.slug = $1');
	});

	it('finds the org behind an invitation', async () => {
		org({ suspended: true });

		expect(await organizationStatusFor({ path: '/organization/accept-invitation', body: { invitationId: 'inv1' } }, null)).toBe('suspended');
		expect(String(pool.query.mock.calls[0][0])).toContain('JOIN auth.invitation');
	});

	it('falls back to the session’s active org', async () => {
		org({});

		expect(await organizationStatusFor({ path: '/organization/list-members', body: {} }, ORG)).toBe('active');
		expect(pool.query.mock.calls[0][1]).toEqual([ORG]);
	});

	it('treats clearing the active org as acting on nothing', async () => {
		expect(await organizationStatusFor({ path: '/organization/set-active', body: { organizationId: null } }, ORG)).toBeNull();
		expect(pool.query).not.toHaveBeenCalled();
	});

	it('reports an unknown org as missing', async () => {
		org(null);

		expect(await organizationStatusFor({ path: '/organization/update', body: { organizationId: ORG } }, null)).toBe('missing');
	});
});
