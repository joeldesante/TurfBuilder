import { describe, it, expect, vi, beforeEach } from 'vitest';

const { startImpersonation } = vi.hoisted(() => ({ startImpersonation: vi.fn() }));
vi.mock('$lib/server/services/impersonation.service', () => ({ startImpersonation }));

import { POST } from './+server';

const ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/users/[user_id]/impersonations', () => {
	it('answers 401 when signed out', async () => {
		await expect(
			POST({ params: { user_id: ID }, locals: {}, request: new Request('http://x', { method: 'POST' }) } as never)
		).rejects.toMatchObject({ status: 401 });
	});

	it('starts impersonating with the request headers, so the cookie can be swapped', async () => {
		startImpersonation.mockResolvedValue({ userId: ID, expiresAt: '2026-10-20T01:00:00.000Z' });
		const request = new Request('http://x', { method: 'POST', headers: { cookie: 'a=b' } });

		const res = await POST({ params: { user_id: ID }, locals: { user: { id: 'u1' } }, request } as never);

		expect(startImpersonation).toHaveBeenCalledWith('u1', ID, request.headers);
		expect(res.status).toBe(201);
	});
});
