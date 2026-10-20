import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ testStorageConnection: vi.fn(async () => undefined) }));
vi.mock('$lib/server/services/system-tests.service', () => svc);

import { POST } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

beforeEach(() => vi.clearAllMocks());

describe('POST /storage-tests', () => {
	it('answers 401 when signed out', async () => {
		await expect((POST as Handler)({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		expect(svc.testStorageConnection).not.toHaveBeenCalled();
	});

	it('answers 204 after a good probe', async () => {
		const res = await (POST as Handler)({ locals: { user: { id: 'u1' } } } as never);

		expect(svc.testStorageConnection).toHaveBeenCalledWith('u1');
		expect(res.status).toBe(204);
	});
});
