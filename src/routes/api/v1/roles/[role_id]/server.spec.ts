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
	getRole: vi.fn(),
	renameRole: vi.fn(),
	deleteRole: vi.fn(),
	replaceRolePermissions: vi.fn()
}));
vi.mock('$lib/server/services/roles.service', () => svc);

import { GET, PATCH, DELETE } from './+server';
import { PUT } from './permissions/+server';

const ROLE = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { role_id: ROLE };
const signedIn = { user: { id: 'u1' } };

function send(handler: typeof PATCH | typeof PUT, body: unknown, locals: unknown = signedIn) {
	return handler({
		params,
		locals,
		request: new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/roles/[role_id]', () => {
	it('answers 401 when signed out and 400 for a malformed id', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			GET({ params: { role_id: 'x' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns the role', async () => {
		svc.getRole.mockResolvedValue({ id: ROLE });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ id: ROLE });
		expect(svc.getRole).toHaveBeenCalledWith('u1', ROLE);
	});

	it('renames with a trimmed name, and answers 400 for a blank one', async () => {
		await expect(send(PATCH, { name: '' })).rejects.toMatchObject({ status: 400 });

		svc.renameRole.mockResolvedValue({ id: ROLE });
		await send(PATCH, { name: ' Leads ' });

		expect(svc.renameRole).toHaveBeenCalledWith('u1', ROLE, 'Leads');
	});

	it('deletes and answers 204', async () => {
		const res = await DELETE({ params, locals: signedIn } as never);

		expect(res.status).toBe(204);
		expect(svc.deleteRole).toHaveBeenCalledWith('u1', ROLE);
	});
});

describe('PUT /api/v1/roles/[role_id]/permissions', () => {
	it('answers 400 without a permissions array', async () => {
		await expect(send(PUT, { permissions: 'canvass.use' })).rejects.toMatchObject({ status: 400 });
		expect(svc.replaceRolePermissions).not.toHaveBeenCalled();
	});

	it('hands the keys to the service', async () => {
		svc.replaceRolePermissions.mockResolvedValue({ id: ROLE });

		await send(PUT, { permissions: ['canvass.use'] });

		expect(svc.replaceRolePermissions).toHaveBeenCalledWith('u1', ROLE, ['canvass.use']);
	});
});
