import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } }));
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const { getUser, updateUser, deleteUser } = vi.hoisted(() => ({
	getUser: vi.fn(),
	updateUser: vi.fn(),
	deleteUser: vi.fn()
}));
vi.mock('$lib/server/services/platform-users.service', () => ({ getUser, updateUser, deleteUser }));

import { GET, PATCH, DELETE } from './+server';

const ID = '22222222-2222-4222-8222-222222222222';
const params = { user_id: ID };
const signedIn = { user: { id: 'u1' } };

function withBody(handler: typeof PATCH, method: string, body: unknown, p = params) {
	return handler({
		params: p,
		locals: signedIn,
		request: new Request('http://x', { method, body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/users/[user_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(GET({ params: { user_id: 'nope' }, locals: signedIn } as never)).rejects.toMatchObject({ status: 400 });
		expect(getUser).not.toHaveBeenCalled();
	});

	it('returns the user', async () => {
		getUser.mockResolvedValue({ id: ID });
		const res = await GET({ params, locals: signedIn } as never);
		expect(getUser).toHaveBeenCalledWith('u1', ID);
		expect(await res.json()).toEqual({ id: ID });
	});
});

describe('PATCH /api/v1/users/[user_id]', () => {
	it('answers 400 for an empty or invalid body', async () => {
		await expect(withBody(PATCH, 'PATCH', {})).rejects.toMatchObject({ status: 400 });
		await expect(withBody(PATCH, 'PATCH', { email: 'not-an-email' })).rejects.toMatchObject({ status: 400 });
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('passes the normalized changes to the service', async () => {
		updateUser.mockResolvedValue({ id: ID });
		await withBody(PATCH, 'PATCH', { email: ' Ada@Example.com ', name: 'Ada' });
		expect(updateUser).toHaveBeenCalledWith('u1', ID, { email: 'ada@example.com', name: 'Ada' });
	});
});

describe('DELETE /api/v1/users/[user_id]', () => {
	it('needs the confirmation email', async () => {
		await expect(withBody(DELETE, 'DELETE', {})).rejects.toMatchObject({ status: 400 });
	});

	it('answers 204', async () => {
		const res = await withBody(DELETE, 'DELETE', { confirmEmail: 'ada@example.com' });
		expect(deleteUser).toHaveBeenCalledWith('u1', ID, 'ada@example.com');
		expect(res.status).toBe(204);
	});
});
