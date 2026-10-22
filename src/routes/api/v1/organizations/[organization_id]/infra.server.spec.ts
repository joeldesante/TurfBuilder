// The organization endpoints, and the flat ones for its members, invitations,
// and invite links. Each answers 401 signed out, 400 for a bad id or body, and
// otherwise hands its input to the service.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	getOrg: vi.fn(async () => ({ id: 'org' })),
	deleteOrg: vi.fn(async () => undefined),
	restoreOrg: vi.fn(async () => undefined),
	suspendOrg: vi.fn(async () => undefined),
	unsuspendOrg: vi.fn(async () => undefined),
	transferOwnership: vi.fn(async () => undefined),
	listOrgMembers: vi.fn(async () => ({ items: [] })),
	listOrgInvitations: vi.fn(async () => ({ invitations: [], links: [] })),
	listOrgActivity: vi.fn(async () => ({ items: [] })),
	listOrgAudit: vi.fn(async () => ({ items: [] })),
	removeMember: vi.fn(async () => undefined),
	cancelInvitation: vi.fn(async () => undefined),
	revokeInviteLink: vi.fn(async () => undefined)
}));
vi.mock('$lib/server/services/platform-organizations.service', () => svc);
vi.mock('$lib/server/services/organizations.service', () => ({
	getOrganization: vi.fn(),
	replaceOrganization: vi.fn(),
	updateOrganization: vi.fn()
}));

import * as org from './+server';
import * as restorations from './restorations/+server';
import * as suspension from './suspension/+server';
import * as ownership from './ownership/+server';
import * as invitations from './invitations/+server';
import * as activity from './activity-events/+server';
import * as auditEvents from './audit-events/+server';
import * as member from '../../members/[member_id]/+server';
import * as invitation from '../../invitations/[invitation_id]/+server';
import * as inviteLink from '../../invite-links/[invite_link_id]/+server';

type Handler = (e: never) => Response | Promise<Response>;

const ORG = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const MEMBER = 'b1b2c3d4-e5f6-4890-abcd-ef1234567890';
const signedIn = { user: { id: 'u1' } };

function call(handler: Handler, params: Record<string, string>, body?: unknown, locals: unknown = signedIn) {
	return handler({
		params,
		locals,
		url: new URL('http://x?page=2'),
		request: new Request('http://x', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

const byOrgId: [string, Handler, ReturnType<typeof vi.fn>, unknown[], number][] = [
	['POST restorations', restorations.POST, svc.restoreOrg, ['u1', ORG], 204],
	['DELETE suspension', suspension.DELETE, svc.unsuspendOrg, ['u1', ORG], 204],
	['GET invitations', invitations.GET, svc.listOrgInvitations, ['u1', ORG], 200],
	['GET activity-events', activity.GET, svc.listOrgActivity, ['u1', ORG, 2], 200],
	['GET audit-events', auditEvents.GET, svc.listOrgAudit, ['u1', ORG, 2], 200]
];

describe.each(byOrgId)('%s', (_name, handler, service, args, status) => {
	it('answers 401 when signed out', async () => {
		await expect(call(handler, { organization_id: ORG }, undefined, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(call(handler, { organization_id: 'x' })).rejects.toMatchObject({ status: 400 });
		expect(service).not.toHaveBeenCalled();
	});

	it('calls its service', async () => {
		const res = await call(handler, { organization_id: ORG });
		expect(service).toHaveBeenCalledWith(...args);
		expect(res.status).toBe(status);
	});
});

describe('with a body', () => {
	it('deletes once the slug is sent', async () => {
		await expect(call(org.DELETE, { organization_id: ORG }, {})).rejects.toMatchObject({ status: 400 });
		const res = await call(org.DELETE, { organization_id: ORG }, { confirmSlug: 'riverside' });
		expect(svc.deleteOrg).toHaveBeenCalledWith('u1', ORG, 'riverside');
		expect(res.status).toBe(204);
	});

	it('suspends with a reason', async () => {
		await expect(call(suspension.PUT, { organization_id: ORG }, { reason: ' ' })).rejects.toMatchObject({ status: 400 });
		await call(suspension.PUT, { organization_id: ORG }, { reason: 'Unpaid' });
		expect(svc.suspendOrg).toHaveBeenCalledWith('u1', ORG, 'Unpaid');
	});

	it('transfers ownership to a member', async () => {
		await expect(call(ownership.PUT, { organization_id: ORG }, { memberId: 'x' })).rejects.toMatchObject({ status: 400 });
		await call(ownership.PUT, { organization_id: ORG }, { memberId: MEMBER });
		expect(svc.transferOwnership).toHaveBeenCalledWith('u1', ORG, MEMBER);
	});
});

describe('flat endpoints', () => {
	it('removes a member', async () => {
		const res = await call(member.DELETE, { member_id: MEMBER });
		expect(svc.removeMember).toHaveBeenCalledWith('u1', MEMBER);
		expect(res.status).toBe(204);
	});

	it('cancels an invitation', async () => {
		await expect(call(invitation.DELETE, { invitation_id: 'x' })).rejects.toMatchObject({ status: 400 });
		await call(invitation.DELETE, { invitation_id: MEMBER });
		expect(svc.cancelInvitation).toHaveBeenCalledWith('u1', MEMBER);
	});

	it('revokes an invite link by its token id', async () => {
		await expect(call(inviteLink.DELETE, { invite_link_id: 'bad id!' })).rejects.toMatchObject({ status: 400 });
		await call(inviteLink.DELETE, { invite_link_id: 'aB3_xY-9' });
		expect(svc.revokeInviteLink).toHaveBeenCalledWith('u1', 'aB3_xY-9');
	});
});
