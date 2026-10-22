import type { AuditEntry } from '$lib/shared/types/audit';

const actor = { actorId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567801', actorName: 'Grace Hopper', actorEmail: 'grace@example.org', ip: '203.0.113.7', userAgent: null };

export const entries: AuditEntry[] = [
	{ ...actor, id: '3', action: 'user.suspend', targetType: 'user', targetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567802', metadata: { reason: 'Spam' }, createdAt: '2026-10-19T12:00:00.000Z' },
	{ ...actor, id: '2', action: 'org.suspend', targetType: 'organization', targetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567811', metadata: {}, createdAt: '2026-10-18T12:00:00.000Z' },
	{ ...actor, id: '1', action: 'settings.update', targetType: 'setting', targetId: null, metadata: { changes: [{ key: 'application_name', from: 'TurfBuilder', to: 'Acme' }] }, createdAt: '2026-10-17T12:00:00.000Z' }
];

export const auditPage = { items: entries, totalCount: entries.length, page: 1, pageSize: 100 };
