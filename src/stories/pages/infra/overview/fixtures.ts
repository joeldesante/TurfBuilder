import type { PlatformOverview } from '$lib/shared/types/metrics';
import { wave } from '$components/data-display/charts/fixtures';

/** Sample data for the infra overview story and spec. */
export const overview: PlatformOverview = {
	users: 1142,
	newUsers7d: { value: 168, previous: 140 },
	activeUsers: { daily: 126, weekly: 412, monthly: 903 },
	organizations: 38,
	activeOrgs30d: 29,
	visits7d: { value: 5210, previous: 5830 },
	emails7d: { sent: 214, failed: 0 },
	growth: [
		{ key: 'signups', label: 'New accounts', points: wave(30, 24, 10) },
		{ key: 'active', label: 'Active users', points: wave(30, 120, 30, 2) }
	],
	orgSizes: [
		{ key: '1-5', label: '1 to 5 members', value: 17 },
		{ key: '6-25', label: '6 to 25 members', value: 14 },
		{ key: '26-100', label: '26 to 100 members', value: 5 },
		{ key: '100+', label: 'Over 100 members', value: 2 }
	],
	recentUsers: [
		{ id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567801', name: 'Grace Hopper', email: 'grace@example.org', createdAt: '2026-10-19T10:00:00.000Z' },
		{ id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567802', name: 'Alan Turing', email: 'alan@example.org', createdAt: '2026-10-18T10:00:00.000Z' }
	],
	recentOrgs: [
		{ id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567811', name: 'Riverside Canvass', slug: 'riverside', createdAt: '2026-10-17T10:00:00.000Z' }
	],
	recentAudit: [
		{
			id: '1',
			actorId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567801',
			actorName: 'Grace Hopper',
			actorEmail: 'grace@example.org',
			action: 'user.password_reset_sent',
			targetType: 'user',
			targetId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567802',
			metadata: {},
			ip: '203.0.113.7',
			userAgent: null,
			createdAt: '2026-10-19T12:00:00.000Z'
		}
	],
	status: { mailConfigured: true, storageConfigured: true, migrationNeeded: false, failedEmails24h: 0, failedDocuments24h: 0 },
	externalLinks: [
		{ label: 'Analytics', url: 'https://analytics.turfbuilder.org' },
		{ label: 'Tracing', url: 'https://jaeger.example.org' }
	]
};

export const permissions = ['access', 'users.manage', 'settings.manage', 'orgs.manage', 'audit.read'];
