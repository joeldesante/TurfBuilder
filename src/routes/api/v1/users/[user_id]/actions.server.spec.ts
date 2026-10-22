// The user endpoints that only take an id: each answers 401 signed out, 400
// for a bad id, and otherwise hands the id to its service.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	listUserMemberships: vi.fn(async () => []),
	listUserActivity: vi.fn(async () => ({ items: [] })),
	listUserEmails: vi.fn(async () => ({ items: [] })),
	listUserAudit: vi.fn(async () => ({ items: [] })),
	sendPasswordReset: vi.fn(async () => undefined),
	sendVerificationEmail: vi.fn(async () => undefined),
	resetTwoFactor: vi.fn(async () => undefined),
	revokeSession: vi.fn(async () => undefined)
}));
const roles = vi.hoisted(() => ({
	listUserInfraRoles: vi.fn(async () => []),
	grantInfraRole: vi.fn(async () => undefined),
	revokeInfraRole: vi.fn(async () => undefined),
	listInfraRoles: vi.fn(async () => [])
}));
vi.mock('$lib/server/services/platform-users.service', () => svc);
vi.mock('$lib/server/services/infra-admins.service', () => roles);

import * as memberships from './memberships/+server';
import * as activity from './activity-events/+server';
import * as emails from './email-logs/+server';
import * as auditEvents from './audit-events/+server';
import * as resets from './password-resets/+server';
import * as verifications from './verification-emails/+server';
import * as twoFactor from './two-factor/+server';
import * as infraRoles from './infra-roles/+server';
import * as infraRole from './infra-roles/[role_id]/+server';
import * as session from '../../sessions/[session_id]/+server';
import * as allRoles from '../../infra-roles/+server';

const ID = '22222222-2222-4222-8222-222222222222';
const ROLE = '44444444-4444-4444-8444-444444444444';
const signedIn = { user: { id: 'u1' } };
const url = new URL('http://x?page=2');

function call(handler: (e: never) => Response | Promise<Response>, params: Record<string, string>, locals: unknown = signedIn, body?: unknown) {
	return handler({
		params,
		locals,
		url,
		request: new Request('http://x', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
	} as never);
}

const byId: [string, (e: never) => Response | Promise<Response>, ReturnType<typeof vi.fn>, unknown[], number][] = [
	['GET memberships', memberships.GET, svc.listUserMemberships, ['u1', ID], 200],
	['GET activity-events', activity.GET, svc.listUserActivity, ['u1', ID, 2], 200],
	['GET email-logs', emails.GET, svc.listUserEmails, ['u1', ID, 2], 200],
	['GET audit-events', auditEvents.GET, svc.listUserAudit, ['u1', ID, 2], 200],
	['POST password-resets', resets.POST, svc.sendPasswordReset, ['u1', ID], 202],
	['POST verification-emails', verifications.POST, svc.sendVerificationEmail, ['u1', ID], 202],
	['DELETE two-factor', twoFactor.DELETE, svc.resetTwoFactor, ['u1', ID], 204],
	['GET infra-roles', infraRoles.GET, roles.listUserInfraRoles, ['u1', ID], 200]
];

beforeEach(() => vi.clearAllMocks());

describe.each(byId)('%s', (_name, handler, service, args, status) => {
	it('answers 401 when signed out', async () => {
		await expect(call(handler, { user_id: ID }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(call(handler, { user_id: 'x' })).rejects.toMatchObject({ status: 400 });
		expect(service).not.toHaveBeenCalled();
	});

	it('calls its service', async () => {
		const res = await call(handler, { user_id: ID });
		expect(service).toHaveBeenCalledWith(...args);
		expect(res.status).toBe(status);
	});
});

describe('infra roles', () => {
	it('grants a role from the body', async () => {
		const res = await call(infraRoles.POST, { user_id: ID }, signedIn, { roleId: ROLE });
		expect(roles.grantInfraRole).toHaveBeenCalledWith('u1', ID, ROLE);
		expect(res.status).toBe(204);
	});

	it('answers 400 without a role', async () => {
		await expect(call(infraRoles.POST, { user_id: ID }, signedIn, {})).rejects.toMatchObject({ status: 400 });
	});

	it('revokes a role', async () => {
		await call(infraRole.DELETE, { user_id: ID, role_id: ROLE });
		expect(roles.revokeInfraRole).toHaveBeenCalledWith('u1', ID, ROLE);
	});

	it('lists every role', async () => {
		await call(allRoles.GET, {});
		expect(roles.listInfraRoles).toHaveBeenCalledWith('u1');
	});
});

describe('DELETE /api/v1/sessions/[session_id]', () => {
	it('ends the session', async () => {
		const res = await call(session.DELETE, { session_id: ID });
		expect(svc.revokeSession).toHaveBeenCalledWith('u1', ID);
		expect(res.status).toBe(204);
	});

	it('answers 400 for a malformed id', async () => {
		await expect(call(session.DELETE, { session_id: 'x' })).rejects.toMatchObject({ status: 400 });
	});
});
