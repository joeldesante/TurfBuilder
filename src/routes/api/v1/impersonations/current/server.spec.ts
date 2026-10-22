import { describe, it, expect, vi, beforeEach } from 'vitest';

const { stopImpersonation } = vi.hoisted(() => ({ stopImpersonation: vi.fn() }));
vi.mock('$lib/server/services/impersonation.service', () => ({ stopImpersonation }));

import { DELETE } from './+server';

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/v1/impersonations/current', () => {
	it('answers 401 when signed out', async () => {
		await expect(DELETE({ locals: {}, request: new Request('http://x') } as never)).rejects.toMatchObject({
			status: 401
		});
	});

	it('stops and says who was impersonated', async () => {
		stopImpersonation.mockResolvedValue({ userId: 'target' });
		const locals = { user: { id: 'target' }, impersonatedBy: 'admin' };
		const res = await DELETE({ locals, request: new Request('http://x') } as never);
		expect(stopImpersonation).toHaveBeenCalledWith(locals, expect.any(Headers));
		expect(await res.json()).toEqual({ userId: 'target' });
	});
});
