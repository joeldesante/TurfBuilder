import { describe, it, expect, vi, beforeEach } from 'vitest';

const { suspendUser, unsuspendUser } = vi.hoisted(() => ({ suspendUser: vi.fn(), unsuspendUser: vi.fn() }));
vi.mock('$lib/server/services/platform-users.service', () => ({ suspendUser, unsuspendUser }));

import { PUT, DELETE } from './+server';

const ID = '22222222-2222-4222-8222-222222222222';

function put(body: unknown, locals: unknown = { user: { id: 'u1' } }) {
	return PUT({
		params: { user_id: ID },
		locals,
		request: new Request('http://x', { method: 'PUT', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/v1/users/[user_id]/suspension', () => {
	it('answers 401 when signed out', async () => {
		await expect(put({ reason: 'x' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('needs a reason', async () => {
		await expect(put({ reason: '  ' })).rejects.toMatchObject({ status: 400 });
	});

	it('refuses an end date in the past', async () => {
		await expect(put({ reason: 'Spam', expiresAt: '2001-01-01T00:00:00Z' })).rejects.toMatchObject({ status: 400 });
	});

	it('suspends with an optional end', async () => {
		suspendUser.mockResolvedValue({ id: ID, suspended: true });
		const until = new Date(Date.now() + 86_400_000).toISOString();
		await put({ reason: 'Spam', expiresAt: until });
		expect(suspendUser).toHaveBeenCalledWith('u1', ID, { reason: 'Spam', expiresAt: until });
	});
});

describe('DELETE /api/v1/users/[user_id]/suspension', () => {
	it('lifts the suspension', async () => {
		unsuspendUser.mockResolvedValue({ id: ID, suspended: false });
		const res = await DELETE({ params: { user_id: ID }, locals: { user: { id: 'u1' } } } as never);
		expect(unsuspendUser).toHaveBeenCalledWith('u1', ID);
		expect(await res.json()).toEqual({ id: ID, suspended: false });
	});
});
