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

const svc = vi.hoisted(() => ({ listRoles: vi.fn(), createRole: vi.fn() }));
vi.mock('$lib/server/services/roles.service', () => svc);

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG };
const signedIn = { user: { id: 'u1' } };

function post(body: unknown, locals: unknown = signedIn) {
	return POST({
		params,
		locals,
		request: new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/organizations/[organization_id]/roles', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed organization id', async () => {
		await expect(
			GET({ params: { organization_id: 'x' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the organization's roles", async () => {
		svc.listRoles.mockResolvedValue([{ id: 'r1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 'r1' }]);
		expect(svc.listRoles).toHaveBeenCalledWith('u1', ORG);
	});
});

describe('POST /api/v1/organizations/[organization_id]/roles', () => {
	it('answers 401 when signed out', async () => {
		await expect(post({ name: 'A' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a blank name or a weight of 0, which is reserved for administrators', async () => {
		await expect(post({ name: ' ' })).rejects.toMatchObject({ status: 400 });
		await expect(post({ name: 'A', weight: 0 })).rejects.toMatchObject({ status: 400 });
		expect(svc.createRole).not.toHaveBeenCalled();
	});

	it('creates the role and answers 201', async () => {
		svc.createRole.mockResolvedValue({ id: 'r1' });

		const res = await post({ name: '  Canvasser ', weight: 20 });

		expect(res.status).toBe(201);
		expect(svc.createRole).toHaveBeenCalledWith('u1', ORG, { name: 'Canvasser', weight: 20 });
	});
});
