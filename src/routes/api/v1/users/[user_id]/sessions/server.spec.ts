import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listUserSessions, revokeUserSessions } = vi.hoisted(() => ({
	listUserSessions: vi.fn(),
	revokeUserSessions: vi.fn()
}));
vi.mock('$lib/server/services/platform-users.service', () => ({ listUserSessions, revokeUserSessions }));

import { GET, DELETE } from './+server';

const ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/users/[user_id]/sessions', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params: { user_id: ID }, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('lists the sessions', async () => {
		listUserSessions.mockResolvedValue([{ id: 's1' }]);
		const res = await GET({ params: { user_id: ID }, locals: { user: { id: 'u1' } } } as never);
		expect(await res.json()).toEqual([{ id: 's1' }]);
	});

	it('revokes everything for another user', async () => {
		revokeUserSessions.mockResolvedValue(3);
		const res = await DELETE({
			params: { user_id: ID },
			locals: { user: { id: 'u1' }, session: { id: 'mine' } }
		} as never);
		expect(revokeUserSessions).toHaveBeenCalledWith('u1', ID, undefined);
		expect(await res.json()).toEqual({ revoked: 3 });
	});

	it('keeps the current session when revoking your own', async () => {
		revokeUserSessions.mockResolvedValue(1);
		await DELETE({ params: { user_id: ID }, locals: { user: { id: ID }, session: { id: 'mine' } } } as never);
		expect(revokeUserSessions).toHaveBeenCalledWith(ID, ID, 'mine');
	});
});
