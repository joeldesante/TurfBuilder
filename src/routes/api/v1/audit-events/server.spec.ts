import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({ listAuditEvents: vi.fn(async () => ({ items: [], totalCount: 0, page: 1, pageSize: 100 })) }));
vi.mock('$lib/server/services/audit.service', () => svc);

import { GET } from './+server';

type Handler = (e: never) => Response | Promise<Response>;
const ACTOR = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

function get(query: string, locals: unknown = { user: { id: 'u1' } }) {
	return (GET as Handler)({ locals, url: new URL(`http://x?${query}`) } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /audit-events', () => {
	it('answers 401 when signed out', async () => {
		await expect(get('', {})).rejects.toMatchObject({ status: 401 });
	});

	it('passes the filters and page to the service', async () => {
		await get(`actorId=${ACTOR}&action=user.suspend&targetType=user&from=2026-10-01&page=2`);

		expect(svc.listAuditEvents).toHaveBeenCalledWith('u1', { actorId: ACTOR, action: 'user.suspend', targetType: 'user', from: '2026-10-01' }, 2);
	});

	it('ignores malformed filters instead of failing', async () => {
		await get(`actorId=nope&targetType=bogus&action=user.delete`);

		expect(svc.listAuditEvents).toHaveBeenCalledWith('u1', { action: 'user.delete' }, 0);
	});
});
