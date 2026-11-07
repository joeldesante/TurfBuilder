import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg, canInfra, platformRevoke } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn(),
	canInfra: vi.fn(),
	platformRevoke: vi.fn(async () => undefined)
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

vi.mock('$lib/server/permissions', () => ({ canOrg, canInfra }));
vi.mock('$lib/server/services/platform-organizations.service', () => ({
	revokeInviteLink: platformRevoke
}));

const { recordEvent } = vi.hoisted(() => ({ recordEvent: vi.fn(async () => undefined) }));
vi.mock('$lib/server/services/activity.service', () => ({ recordEvent }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

import {
	listInviteLinks,
	createInviteLink,
	revokeInviteLink,
	setSlugInvite,
	getInvite,
	acceptInvite
} from './invite-links.service';

/** Answers the caller's membership (`member` false: not one) and everything else with `rest`. */
function stub(rest: (sql: string) => unknown = () => ({ rowCount: 1, rows: [] }), member = true) {
	mockClient.query.mockImplementation((sql: string) => {
		if (sql.includes('JOIN auth.organization o ON o.id = m.organization_id')) {
			return Promise.resolve(
				member
					? {
							rowCount: 1,
							rows: [{ organization_id: ORG, role: 'member', suspended: false, deleted: false }]
						}
					: { rowCount: 0, rows: [] }
			);
		}
		return Promise.resolve(rest(sql));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	canInfra.mockResolvedValue(false);
	stub();
});

describe('every operation', () => {
	it.each([
		['listInviteLinks', () => listInviteLinks('u1', ORG)],
		['createInviteLink', () => createInviteLink('u1', ORG, null)],
		['setSlugInvite', () => setSlugInvite('u1', ORG, true)]
	])('%s answers 403 without member.invite and changes nothing', async (_name, run) => {
		canOrg.mockResolvedValue(false);

		await expect(run()).rejects.toMatchObject({ status: 403 });
		const sql = mockClient.query.mock.calls.map((c) => String(c[0])).join('\n');
		expect(sql).not.toMatch(/org_invite_link|org_slug_invite/);
	});
});

describe('listInviteLinks', () => {
	it("returns the org's links and treats a missing slug row as off", async () => {
		stub((sql) =>
			sql.includes('FROM org_invite_link')
				? { rowCount: 1, rows: [{ id: 'l1' }] }
				: { rowCount: 0, rows: [] }
		);

		expect(await listInviteLinks('u1', ORG)).toEqual({
			links: [{ id: 'l1' }],
			slugInviteEnabled: false
		});
		expect(sqlRun('FROM org_invite_link')![1]).toEqual([ORG]);
	});
});

describe('createInviteLink', () => {
	it('creates a link with a random token for the org', async () => {
		stub(() => ({ rowCount: 1, rows: [{ id: 'tok' }] }));

		await createInviteLink('u1', ORG, '2026-12-31');

		const [, values] = sqlRun('INSERT INTO org_invite_link')!;
		expect(values[0]).toMatch(/^[A-Za-z0-9_-]{21}$/);
		expect(values.slice(1)).toEqual([ORG, 'u1', '2026-12-31']);
	});
});

describe('revokeInviteLink', () => {
	it('hands an infra admin with orgs.manage to the audited platform revoke', async () => {
		canInfra.mockResolvedValue(true);

		await revokeInviteLink('u1', 'tok');

		expect(platformRevoke).toHaveBeenCalledWith('u1', 'tok');
		expect(sqlRun('DELETE FROM org_invite_link')).toBeUndefined();
	});

	it('answers 404 for an unknown link', async () => {
		stub(() => ({ rowCount: 0, rows: [] }));

		await expect(revokeInviteLink('u1', 'tok')).rejects.toMatchObject({ status: 404 });
	});

	it("answers 404 for another org's link, as if it did not exist", async () => {
		stub(() => ({ rowCount: 1, rows: [{ org_id: ORG }] }), false);

		await expect(revokeInviteLink('u1', 'tok')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Invite link not found.' }
		});
		expect(sqlRun('DELETE FROM org_invite_link')).toBeUndefined();
	});

	it('deletes the link for staff with member.invite', async () => {
		stub(() => ({ rowCount: 1, rows: [{ org_id: ORG }] }));

		await revokeInviteLink('u1', 'tok');

		expect(sqlRun('DELETE FROM org_invite_link')![1]).toEqual(['tok', ORG]);
	});
});

describe('setSlugInvite', () => {
	it('saves the toggle for the org', async () => {
		await setSlugInvite('u1', ORG, true);

		expect(sqlRun('INSERT INTO org_slug_invite')![1]).toEqual([ORG, true]);
	});
});

describe('joining through a link', () => {
	const invite = { orgId: ORG, orgName: 'Riverside', orgSlug: 'riverside' };

	/** The token link answers `link`, the slug invite `slug`, the member check `member`. */
	function lookups({ link = true, slug = false, member = false } = {}) {
		mockClient.query.mockImplementation(async (sql: string) => {
			if (sql.includes('FROM org_invite_link l'))
				return { rowCount: link ? 1 : 0, rows: link ? [invite] : [] };
			if (sql.includes('JOIN org_slug_invite'))
				return { rowCount: slug ? 1 : 0, rows: slug ? [invite] : [] };
			if (sql.includes('SELECT 1 FROM auth.member')) return { rowCount: member ? 1 : 0, rows: [] };
			return { rowCount: 1, rows: [{ id: 'm1' }] };
		});
	}

	it('answers 404 for a token that joins nothing', async () => {
		lookups({ link: false, slug: false });

		await expect(getInvite('tok', 'u1')).rejects.toMatchObject({ status: 404 });
		await expect(acceptInvite('u1', 'tok')).rejects.toMatchObject({ status: 404 });
		expect(sqlRun('INSERT INTO auth.member')).toBeUndefined();
	});

	it('falls back to an open slug invite', async () => {
		lookups({ link: false, slug: true });

		expect(await getInvite('riverside', null)).toEqual({ ...invite, alreadyMember: false });
	});

	it('says whether the caller is already a member', async () => {
		lookups({ member: true });

		expect((await getInvite('tok', 'u1')).alreadyMember).toBe(true);
	});

	it('adds the caller as a plain member and records that they joined', async () => {
		lookups();

		expect(await acceptInvite('u1', 'tok')).toEqual({ orgSlug: 'riverside' });
		expect(sqlRun('INSERT INTO auth.member')![1]).toEqual(['u1', ORG]);
		expect(recordEvent).toHaveBeenCalledWith('member.joined', {
			userId: 'u1',
			orgId: ORG,
			sourceKey: 'member.joined:m1'
		});
	});

	it('changes nothing for someone already in the org', async () => {
		lookups({ member: true });

		await acceptInvite('u1', 'tok');

		expect(sqlRun('INSERT INTO auth.member')).toBeUndefined();
		expect(recordEvent).not.toHaveBeenCalled();
	});
});
