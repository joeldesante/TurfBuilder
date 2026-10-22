import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { pool, requireInfraPermission } = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn()
}));

vi.mock('$lib/server/database', () => ({ POOL: pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission }));
vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		getClientAddress: () => '203.0.113.9',
		request: new Request('http://localhost', { headers: { 'user-agent': 'Spec Browser' } })
	})
}));

import { audit, listAuditEvents, listAuditEventsFor, queryAuditPage } from './audit.service';

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

const row = {
	id: 7,
	actor_id: 'u1',
	actor_name: 'Ada',
	actor_email: 'ada@example.com',
	action: 'user.suspend',
	target_type: 'user',
	target_id: 'u2',
	metadata: { reason: 'spam' },
	ip: '203.0.113.9',
	user_agent: 'Spec Browser',
	created_at: new Date('2026-10-01T12:00:00Z')
};

beforeEach(() => {
	vi.clearAllMocks();
	requireInfraPermission.mockResolvedValue(undefined);
	pool.query.mockImplementation((sql: string) =>
		Promise.resolve(sql.includes('COUNT(*)') ? { rows: [{ count: '1' }] } : { rows: [row], rowCount: 1 })
	);
});

describe('audit', () => {
	it('records the actor, action, target, and where the request came from', async () => {
		await audit('u1', 'user.suspend', { type: 'user', id: 'u2' }, { reason: 'spam' });

		const [sql, params] = pool.query.mock.calls[0];
		expect(flat(sql)).toContain('INSERT INTO infra_audit_log');
		expect(params).toEqual(['u1', 'user.suspend', 'user', 'u2', '{"reason":"spam"}', '203.0.113.9', 'Spec Browser']);
	});

	it('throws when it cannot record, so a change is never reported without a record', async () => {
		pool.query.mockRejectedValue(new Error('db down'));
		await expect(audit('u1', 'x', { type: 'system' })).rejects.toThrow('db down');
	});
});

describe('queryAuditPage', () => {
	it('maps rows and pages newest first', async () => {
		const page = await queryAuditPage({}, 1);

		expect(page).toMatchObject({ totalCount: 1, page: 1, pageSize: 100 });
		expect(page.items[0]).toMatchObject({ id: '7', actorName: 'Ada', targetId: 'u2', createdAt: '2026-10-01T12:00:00.000Z' });
		const list = pool.query.mock.calls.find((c) => flat(c[0]).includes('ORDER BY'));
		expect(flat(list?.[0])).toContain('ORDER BY l.created_at DESC, l.id DESC');
	});

	it('filters with parameters, never interpolated values', async () => {
		await queryAuditPage({ action: "x'; DROP TABLE x; --", targetType: 'user', from: '2026-01-01' }, 1);

		const [sql, params] = pool.query.mock.calls[0];
		expect(flat(sql)).toContain('WHERE l.action = $1 AND l.target_type = $2 AND l.created_at >= $3::date');
		expect(params).toEqual(["x'; DROP TABLE x; --", 'user', '2026-01-01']);
	});
});

describe('access', () => {
	it('the audit page requires audit.read', async () => {
		await listAuditEvents('u1', {}, 1);
		expect(requireInfraPermission).toHaveBeenCalledWith('u1', 'audit.read');
	});

	it('a detail page tab requires access', async () => {
		await listAuditEventsFor('u1', { type: 'organization', id: 'o1' }, 1);
		expect(requireInfraPermission).toHaveBeenCalledWith('u1', 'access');
	});

	it('nothing is read when the check fails', async () => {
		requireInfraPermission.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));

		await expect(listAuditEvents('u1', {}, 1)).rejects.toMatchObject({ status: 403 });
		expect(pool.query).not.toHaveBeenCalled();
	});
});
