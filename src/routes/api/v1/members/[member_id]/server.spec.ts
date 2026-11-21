import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const svc = vi.hoisted(() => ({
	removeMember: vi.fn(),
	setMemberRole: vi.fn(),
	setMemberPermission: vi.fn()
}));
vi.mock('$lib/server/services/members.service', () => svc);

import { PATCH } from './+server';
import { PUT, DELETE } from './permissions/[permission_id]/+server';

const MEMBER = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ROLE = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PERMISSION = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';
const signedIn = { user: { id: 'u1' } };

function send(handler: typeof PATCH | typeof PUT, params: object, body: unknown) {
	return handler({
		params,
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/v1/members/[member_id]', () => {
	it('answers 400 for a role id that is not a uuid', async () => {
		await expect(send(PATCH, { member_id: MEMBER }, { role_id: 'admin' })).rejects.toMatchObject({
			status: 400
		});
		expect(svc.setMemberRole).not.toHaveBeenCalled();
	});

	it('sets the role, or clears it with null, and answers 204', async () => {
		expect((await send(PATCH, { member_id: MEMBER }, { role_id: ROLE })).status).toBe(204);
		await send(PATCH, { member_id: MEMBER }, { role_id: null });

		expect(svc.setMemberRole).toHaveBeenNthCalledWith(1, 'u1', MEMBER, ROLE);
		expect(svc.setMemberRole).toHaveBeenNthCalledWith(2, 'u1', MEMBER, null);
	});
});

describe('/api/v1/members/[member_id]/permissions/[permission_id]', () => {
	const params = { member_id: MEMBER, permission_id: PERMISSION };

	it('answers 401 when signed out', async () => {
		await expect(DELETE({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed permission id or a value that is not a boolean', async () => {
		await expect(
			send(PUT, { ...params, permission_id: 'x' }, { value: true })
		).rejects.toMatchObject({ status: 400 });
		await expect(send(PUT, params, { value: null })).rejects.toMatchObject({ status: 400 });
		expect(svc.setMemberPermission).not.toHaveBeenCalled();
	});

	it('grants or denies with PUT', async () => {
		expect((await send(PUT, params, { value: false })).status).toBe(204);
		expect(svc.setMemberPermission).toHaveBeenCalledWith('u1', MEMBER, PERMISSION, false);
	});

	it('drops the override with DELETE', async () => {
		expect((await DELETE({ params, locals: signedIn } as never)).status).toBe(204);
		expect(svc.setMemberPermission).toHaveBeenCalledWith('u1', MEMBER, PERMISSION, null);
	});
});
