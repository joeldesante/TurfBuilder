import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ sendTestMail: vi.fn(async () => ({ to: 'grace@example.com' })) }));
vi.mock('$lib/server/services/system-tests.service', () => svc);

import { POST } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

beforeEach(() => vi.clearAllMocks());

describe('POST /mail-tests', () => {
	it('answers 401 when signed out', async () => {
		await expect((POST as Handler)({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		expect(svc.sendTestMail).not.toHaveBeenCalled();
	});

	it('sends for the signed-in admin', async () => {
		const res = await (POST as Handler)({ locals: { user: { id: 'u1' } } } as never);

		expect(svc.sendTestMail).toHaveBeenCalledWith('u1');
		expect(await res.json()).toEqual({ to: 'grace@example.com' });
	});
});
