import type { MetricResult, PlatformMetrics } from '$lib/shared/types/metrics';
import { activeUsers, cohortCells, cohortCols, cohortRows, signInMethods, signups, topOrgs, visitsStack, wave } from '$components/data-display/charts/fixtures';

const series = (title: string, s = signups, format: 'number' | 'percent' = 'number'): MetricResult => ({ kind: 'series', title, format, series: s });
const categories = (title: string, data = signInMethods): MetricResult => ({ kind: 'categories', title, format: 'number', data });

/** Sample platform metrics for the infra metrics page story and spec. */
export const metrics: PlatformMetrics = {
	window: { range: '30d', granularity: 'day', from: '2026-09-20T00:00:00.000Z', to: '2026-10-20T00:00:00.000Z' },
	signups: series('New accounts'),
	total_users: series('Total accounts', [{ key: 'total', label: 'Accounts', points: wave(60, 900, 100, 3) }]),
	new_orgs: series('New organizations', [{ key: 'orgs', label: 'New organizations', points: wave(60, 2, 2, 4) }]),
	active_users: series('Active users', activeUsers),
	stickiness: series('Stickiness', [{ key: 'stickiness', label: 'Daily over monthly', points: wave(60, 20, 6, 5) }], 'percent'),
	sign_ins: series('Sign-ins', [{ key: 'sign_ins', label: 'Sign-ins', points: wave(60, 180, 40, 6) }]),
	visits: series('Canvass visits', visitsStack),
	surveys: series('Survey submissions', [{ key: 'surveys', label: 'Submissions', points: wave(60, 70, 20, 7) }]),
	content: series('Lists, turfs, and documents', [
		{ key: 'lists', label: 'Lists', points: wave(30, 6, 3, 1) },
		{ key: 'turfs', label: 'Turfs', points: wave(30, 9, 4, 2) },
		{ key: 'documents', label: 'Documents', points: wave(30, 4, 2, 3) }
	]),
	emails: series('Emails', [{ key: 'sent', label: 'Sent', points: wave(30, 30, 10, 8) }]),
	top_orgs: categories('Most active organizations', topOrgs),
	event_mix: categories('What people did'),
	two_factor: categories('Two-factor sign-in'),
	email_verified: categories('Email verified'),
	sign_in_methods: categories('Sign-in methods'),
	org_sizes: categories('Organizations by size'),
	retention: { kind: 'matrix', title: 'Weekly retention', format: 'percent', cells: cohortCells, rows: cohortRows, cols: cohortCols }
};
