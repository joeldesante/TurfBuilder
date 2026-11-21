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

const svc = vi.hoisted(() => ({ reorderContactSchemas: vi.fn() }));
vi.mock('$lib/server/services/contact-schemas.service', () => svc);

import { PUT } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const A = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const B = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG };

function put(body: unknown, locals: unknown = { user: { id: 'u1' } }) {
	return PUT({
		params,
		locals,
		request: new Request('http://localhost/x', { method: 'PUT', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/v1/organizations/[organization_id]/contact-schema-order', () => {
	it('answers 401 when signed out', async () => {
		await expect(put({ ids: [A] }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 unless ids is an array of uuids', async () => {
		await expect(put({ ids: ['x'] })).rejects.toMatchObject({ status: 400 });
		await expect(put({})).rejects.toMatchObject({ status: 400 });
		expect(svc.reorderContactSchemas).not.toHaveBeenCalled();
	});

	it('hands the order to the service and answers 204', async () => {
		const res = await put({ ids: [B, A] });

		expect(res.status).toBe(204);
		expect(svc.reorderContactSchemas).toHaveBeenCalledWith('u1', ORG, [B, A]);
	});
});
