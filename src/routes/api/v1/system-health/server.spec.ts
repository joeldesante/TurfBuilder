import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ getSystemHealth: vi.fn(async () => ({ runtime: { nodeVersion: 'v24' } })) }));
vi.mock('$lib/server/services/system-health.service', () => svc);

import { GET } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

beforeEach(() => vi.clearAllMocks());

describe('GET /system-health', () => {
	it('answers 401 when signed out', async () => {
		await expect((GET as Handler)({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		expect(svc.getSystemHealth).not.toHaveBeenCalled();
	});

	it('returns the health report for the caller', async () => {
		const res = await (GET as Handler)({ locals: { user: { id: 'u1' } } } as never);

		expect(svc.getSystemHealth).toHaveBeenCalledWith('u1');
		expect(await res.json()).toEqual({ runtime: { nodeVersion: 'v24' } });
	});
});
