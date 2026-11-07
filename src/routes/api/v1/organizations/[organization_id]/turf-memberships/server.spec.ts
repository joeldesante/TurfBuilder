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

const { joinTurfByCode } = vi.hoisted(() => ({ joinTurfByCode: vi.fn() }));
vi.mock('$lib/server/services/turfs.service', () => ({ joinTurfByCode }));

import { POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function post(body: unknown, locals: unknown = { user: { id: 'u1' } }) {
	return POST({
		params: { organization_id: ORG },
		locals,
		request: new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/organizations/[organization_id]/turf-memberships', () => {
	it('answers 401 when signed out', async () => {
		await expect(post({ code: 'ABC123' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a code that is not 6 characters', async () => {
		await expect(post({ code: 'ABC' })).rejects.toMatchObject({ status: 400 });
		expect(joinTurfByCode).not.toHaveBeenCalled();
	});

	it('joins the turf and answers 201 with its id', async () => {
		joinTurfByCode.mockResolvedValue({ id: 't1' });

		const res = await post({ code: ' ABC123 ' });

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ id: 't1' });
		expect(joinTurfByCode).toHaveBeenCalledWith('u1', ORG, 'ABC123');
	});
});
