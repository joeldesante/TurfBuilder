import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ listEmailLog: vi.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 100 })) }));
vi.mock('$lib/server/services/email-log.service', () => svc);

import { GET } from './+server';

type Handler = (e: never) => Response | Promise<Response>;

beforeEach(() => vi.clearAllMocks());

describe('GET /email-logs', () => {
	it('answers 401 when signed out', async () => {
		await expect((GET as Handler)({ locals: {}, url: new URL('http://x') } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('passes the filters and page to the service', async () => {
		await (GET as Handler)({ locals: { user: { id: 'u1' } }, url: new URL('http://x?status=failed&template=auth.reset_password&page=3') } as never);

		expect(svc.listEmailLog).toHaveBeenCalledWith('u1', { status: 'failed', template: 'auth.reset_password' }, 3);
	});
});
