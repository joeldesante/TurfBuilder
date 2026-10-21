import { POOL } from '$lib/server/database';
import { requireInfraPermission, canInfra } from '$lib/server/permissions';
import { isMailConfigured } from '$lib/server/mail';
import { isStorageConfigured } from '$lib/server/storage';
import { countBefore, earliest, rollingActiveUsers, timeSeries } from './time-series.service';
import { queryAuditPage } from './audit.service';
import { emailLogTotals } from './email-log.service';
import { isMigrationNeeded } from './migrations.service';
import { getExternalLinks } from './system-settings.service';
import { rangeStart, type DashboardRange } from '$lib/dashboard-range';
import { activityEventLabel } from '$lib/shared/registries/activity-events';
import { cumulative, ratioSeries } from '$lib/shared/utils/chart-series';
import type { CategoryDatum, Granularity, MatrixCell } from '$lib/shared/types/charts';
import type {
	MetricResult,
	MetricsWindow,
	PlatformMetricKey,
	PlatformMetrics,
	PlatformOverview
} from '$lib/shared/types/metrics';
import { PLATFORM_METRICS } from '$lib/shared/types/metrics';
import { mapWithLimit } from '$lib/shared/utils/map-with-limit';

const DAY_MS = 86_400_000;

/** Charts computed at once for the metrics page. */
const METRIC_CONCURRENCY = 3;

interface Window {
	from: Date;
	to: Date;
	granularity: Granularity;
}

/**
 * The dates a range covers. "All time" starts at the first account. A long
 * range is bucketed more coarsely than asked, so no chart has thousands of bars.
 */
export async function resolveWindow(range: DashboardRange, granularity: Granularity, now = new Date()): Promise<Window> {
	const start =
		rangeStart(range, now) ?? (await earliest(POOL, 'users')) ?? new Date(now.getTime() - 29 * DAY_MS);
	const days = (now.getTime() - start.getTime()) / DAY_MS;
	let effective = granularity;
	if (effective === 'day' && days > 400) effective = 'week';
	if (effective === 'week' && days > 1500) effective = 'month';
	return { from: start, to: now, granularity: effective };
}

function windowOut(range: DashboardRange, w: Window): MetricsWindow {
	return { range, granularity: w.granularity, from: w.from.toISOString(), to: w.to.toISOString() };
}

function events(w: Window, type: string, extra: Record<string, string> = {}) {
	return timeSeries(POOL, {
		source: 'activity_events',
		from: w.from,
		to: w.to,
		granularity: w.granularity,
		where: { type, ...extra }
	});
}

/** Each chart, computed on its own so the API can serve one at a time. */
const METRICS: Record<PlatformMetricKey, (w: Window) => Promise<MetricResult>> = {
	signups: async (w) => ({
		kind: 'series',
		title: 'New accounts',
		format: 'number',
		series: [{ key: 'signups', label: 'New accounts', points: await timeSeries(POOL, { source: 'users', ...w }) }]
	}),

	total_users: async (w) => {
		const [before, points] = await Promise.all([
			countBefore(POOL, 'users', w.from),
			timeSeries(POOL, { source: 'users', ...w })
		]);
		return {
			kind: 'series',
			title: 'Total accounts',
			format: 'number',
			series: [{ key: 'total', label: 'Accounts', points: cumulative(points, before) }]
		};
	},

	new_orgs: async (w) => ({
		kind: 'series',
		title: 'New organizations',
		format: 'number',
		series: [{ key: 'orgs', label: 'New organizations', points: await timeSeries(POOL, { source: 'organizations', ...w }) }]
	}),

	active_users: async (w) => {
		const [daily, weekly, monthly] = await Promise.all(
			[1, 7, 30].map((windowDays) => rollingActiveUsers(POOL, { ...w, windowDays }))
		);
		return {
			kind: 'series',
			title: 'Active users',
			format: 'number',
			series: [
				{ key: 'dau', label: 'Active that day', points: daily },
				{ key: 'wau', label: 'Active in 7 days', points: weekly },
				{ key: 'mau', label: 'Active in 30 days', points: monthly }
			]
		};
	},

	stickiness: async (w) => {
		const [daily, monthly] = await Promise.all([
			rollingActiveUsers(POOL, { ...w, windowDays: 1 }),
			rollingActiveUsers(POOL, { ...w, windowDays: 30 })
		]);
		return {
			kind: 'series',
			title: 'Stickiness',
			format: 'percent',
			series: [{ key: 'stickiness', label: 'Daily over monthly active', points: ratioSeries(daily, monthly) }]
		};
	},

	sign_ins: async (w) => ({
		kind: 'series',
		title: 'Sign-ins',
		format: 'number',
		series: [{ key: 'sign_ins', label: 'Sign-ins', points: await events(w, 'user.signed_in') }]
	}),

	visits: async (w) => {
		const [talked, missed] = await Promise.all([
			events(w, 'canvass.visit', { contactMade: 'true' }),
			events(w, 'canvass.visit', { contactMade: 'false' })
		]);
		return {
			kind: 'series',
			title: 'Canvass visits',
			format: 'number',
			series: [
				{ key: 'contact', label: 'Talked to someone', points: talked },
				{ key: 'no_contact', label: 'No answer', points: missed }
			]
		};
	},

	surveys: async (w) => ({
		kind: 'series',
		title: 'Survey submissions',
		format: 'number',
		series: [{ key: 'surveys', label: 'Surveys submitted', points: await events(w, 'survey.submitted') }]
	}),

	content: async (w) => {
		const [lists, turfs, documents] = await Promise.all([
			events(w, 'list.created'),
			events(w, 'turf.created'),
			events(w, 'document.generated')
		]);
		return {
			kind: 'series',
			title: 'Lists, turfs, and documents',
			format: 'number',
			series: [
				{ key: 'lists', label: 'Lists', points: lists },
				{ key: 'turfs', label: 'Turfs', points: turfs },
				{ key: 'documents', label: 'Documents', points: documents }
			]
		};
	},

	emails: async (w) => {
		const [sent, failed] = await Promise.all([
			timeSeries(POOL, { source: 'emails', ...w, where: { status: 'sent' } }),
			timeSeries(POOL, { source: 'emails', ...w, where: { status: 'failed' } })
		]);
		return {
			kind: 'series',
			title: 'Emails',
			format: 'number',
			series: [
				{ key: 'sent', label: 'Sent', points: sent },
				{ key: 'failed', label: 'Failed', points: failed, color: 'var(--chart-8)' }
			]
		};
	},

	top_orgs: async (w) => {
		const result = await POOL.query<{ id: string; name: string; n: string }>(
			`SELECT o.id, o.name, COUNT(*) AS n
			 FROM activity_event e
			 JOIN auth.organization o ON o.id = e.org_id
			 WHERE e.occurred_at >= $1 AND e.occurred_at <= $2 AND o.deleted_at IS NULL
			 GROUP BY o.id
			 ORDER BY n DESC, o.name
			 LIMIT 10`,
			[w.from, w.to]
		);
		return {
			kind: 'categories',
			title: 'Most active organizations',
			format: 'number',
			data: result.rows.map((r) => ({ key: r.id, label: r.name, value: Number(r.n) }))
		};
	},

	event_mix: async (w) => {
		const result = await POOL.query<{ type: string; n: string }>(
			`SELECT type, COUNT(*) AS n FROM activity_event
			 WHERE occurred_at >= $1 AND occurred_at <= $2
			 GROUP BY type ORDER BY n DESC`,
			[w.from, w.to]
		);
		return {
			kind: 'categories',
			title: 'What people did',
			format: 'number',
			data: result.rows.map((r) => ({ key: r.type, label: activityEventLabel(r.type), value: Number(r.n) }))
		};
	},

	two_factor: async () => {
		const result = await POOL.query<{ on: string; off: string }>(
			`SELECT COUNT(*) FILTER (WHERE two_factor_enabled IS TRUE) AS on,
			        COUNT(*) FILTER (WHERE two_factor_enabled IS NOT TRUE) AS off
			 FROM auth.user WHERE deleted_at IS NULL`
		);
		const row = result.rows[0];
		return {
			kind: 'categories',
			title: 'Two-factor sign-in',
			format: 'number',
			data: [
				{ key: 'on', label: 'On', value: Number(row?.on ?? 0) },
				{ key: 'off', label: 'Off', value: Number(row?.off ?? 0) }
			]
		};
	},

	email_verified: async () => {
		const result = await POOL.query<{ yes: string; no: string }>(
			`SELECT COUNT(*) FILTER (WHERE email_verified) AS yes,
			        COUNT(*) FILTER (WHERE NOT email_verified) AS no
			 FROM auth.user WHERE deleted_at IS NULL`
		);
		const row = result.rows[0];
		return {
			kind: 'categories',
			title: 'Email verified',
			format: 'number',
			data: [
				{ key: 'yes', label: 'Verified', value: Number(row?.yes ?? 0) },
				{ key: 'no', label: 'Not verified', value: Number(row?.no ?? 0) }
			]
		};
	},

	sign_in_methods: async () => {
		const result = await POOL.query<{ provider_id: string; n: string }>(
			`SELECT a.provider_id, COUNT(DISTINCT a.user_id) AS n
			 FROM auth.account a JOIN auth.user u ON u.id = a.user_id AND u.deleted_at IS NULL
			 GROUP BY a.provider_id ORDER BY n DESC`
		);
		const names: Record<string, string> = { credential: 'Email and password' };
		return {
			kind: 'categories',
			title: 'Sign-in methods',
			format: 'number',
			data: result.rows.map((r) => ({
				key: r.provider_id,
				label: names[r.provider_id] ?? r.provider_id.charAt(0).toUpperCase() + r.provider_id.slice(1),
				value: Number(r.n)
			}))
		};
	},

	org_sizes: async () => ({
		kind: 'categories',
		title: 'Organizations by size',
		format: 'number',
		data: await orgSizes()
	}),

	retention: async (w) => {
		const { cells, rows, cols } = await retentionCohorts(w);
		return { kind: 'matrix', title: 'Weekly retention', format: 'percent', cells, rows, cols };
	}
};

/** Orgs grouped by how many members they have. */
async function orgSizes(): Promise<CategoryDatum[]> {
	const result = await POOL.query<{ band: string; n: string }>(
		`WITH sizes AS (
		   SELECT o.id, (SELECT COUNT(*) FROM auth.member m WHERE m.organization_id = o.id) AS members
		   FROM auth.organization o WHERE o.deleted_at IS NULL
		 )
		 SELECT CASE
		          WHEN members <= 1 THEN '1'
		          WHEN members <= 5 THEN '2-5'
		          WHEN members <= 20 THEN '6-20'
		          WHEN members <= 100 THEN '21-100'
		          ELSE '100+'
		        END AS band,
		        COUNT(*) AS n
		 FROM sizes GROUP BY band`
	);
	const counts = new Map(result.rows.map((r) => [r.band, Number(r.n)]));
	return ['1', '2-5', '6-20', '21-100', '100+'].map((band) => ({
		key: band,
		label: band === '1' ? '1 member' : `${band} members`,
		value: counts.get(band) ?? 0
	}));
}

/**
 * For each of the last eight sign-up weeks (inside the window), the share of
 * that week's new accounts active in each week after. Weeks that have not
 * happened yet are null.
 */
async function retentionCohorts(w: Window): Promise<{ cells: MatrixCell[]; rows: string[]; cols: string[] }> {
	const WEEKS = 8;
	const since = new Date(Math.max(w.from.getTime(), w.to.getTime() - WEEKS * 7 * DAY_MS));

	const result = await POOL.query<{ week: string; k: number; active: string; size: string }>(
		`WITH cohort AS (
		   SELECT id, date_trunc('week', created_at)::date AS week
		   FROM auth.user
		   WHERE created_at >= date_trunc('week', $1::timestamptz) AND deleted_at IS NULL
		 ),
		 sizes AS (SELECT week, COUNT(*) AS size FROM cohort GROUP BY week),
		 active AS (
		   SELECT c.week, ((date_trunc('week', d.day)::date - c.week) / 7) AS k, COUNT(DISTINCT c.id) AS active
		   FROM cohort c
		   JOIN user_activity_day d ON d.user_id = c.id AND d.org_key = '' AND d.day >= c.week
		   GROUP BY 1, 2
		 )
		 SELECT to_char(s.week, 'YYYY-MM-DD') AS week, a.k, COALESCE(a.active, 0) AS active, s.size
		 FROM sizes s LEFT JOIN active a ON a.week = s.week AND a.k < $2
		 ORDER BY s.week, a.k`,
		[since, WEEKS]
	);

	const rows = [...new Set(result.rows.map((r) => r.week))];
	const cols = Array.from({ length: WEEKS }, (_, k) => String(k));
	const lookup = new Map(result.rows.filter((r) => r.k !== null).map((r) => [`${r.week}|${r.k}`, Number(r.active) / Number(r.size)]));
	const thisWeek = Math.floor((w.to.getTime() - Date.parse('1970-01-05T00:00:00Z')) / (7 * DAY_MS));

	const cells: MatrixCell[] = rows.flatMap((row) => {
		const rowWeek = Math.floor((Date.parse(`${row}T00:00:00Z`) - Date.parse('1970-01-05T00:00:00Z')) / (7 * DAY_MS));
		return cols.map((col) => {
			const k = Number(col);
			return { row, col, value: rowWeek + k > thisWeek ? null : (lookup.get(`${row}|${k}`) ?? 0) };
		});
	});
	return { cells, rows, cols };
}

/** One chart's data, for the metrics API and CSV export. 403 without `access`. */
export async function getPlatformMetric(
	userId: string,
	metric: PlatformMetricKey,
	range: DashboardRange,
	granularity: Granularity
): Promise<{ window: MetricsWindow; metric: MetricResult }> {
	await requireInfraPermission(userId, 'access');
	const w = await resolveWindow(range, granularity);
	return { window: windowOut(range, w), metric: await METRICS[metric](w) };
}

/** Every chart on the metrics page. 403 without `access`. */
export async function getPlatformMetrics(
	userId: string,
	range: DashboardRange,
	granularity: Granularity
): Promise<PlatformMetrics> {
	await requireInfraPermission(userId, 'access');
	const w = await resolveWindow(range, granularity);
	// A few at a time: each chart may run several queries, and all of them at
	// once would hold most of the pool through one page view.
	const results = await mapWithLimit(PLATFORM_METRICS, METRIC_CONCURRENCY, (key) => METRICS[key](w));
	return {
		window: windowOut(range, w),
		...(Object.fromEntries(PLATFORM_METRICS.map((key, i) => [key, results[i]])) as Record<PlatformMetricKey, MetricResult>)
	};
}

/** The overview page: headline figures, growth, what needs attention. 403 without `access`. */
export async function getPlatformOverview(userId: string): Promise<PlatformOverview> {
	await requireInfraPermission(userId, 'access');

	const now = new Date();
	const thirtyDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
	const growthWindow = { from: thirtyDaysAgo, to: now, granularity: 'day' as const };

	const [counts, signups, daily, [dau, wau, mau], users, orgs, emails, sizes, status, links, canAudit] = await Promise.all([
		POOL.query<Record<string, string>>(
			`SELECT
			   (SELECT COUNT(*) FROM auth.user WHERE deleted_at IS NULL) AS users,
			   (SELECT COUNT(*) FROM auth.user WHERE created_at > now() - interval '7 days') AS new_users,
			   (SELECT COUNT(*) FROM auth.user WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days') AS new_users_before,
			   (SELECT COUNT(*) FROM auth.organization WHERE deleted_at IS NULL) AS orgs,
			   (SELECT COUNT(DISTINCT org_key) FROM user_activity_day WHERE org_key <> '' AND day > current_date - 30) AS active_orgs,
			   (SELECT COUNT(*) FROM activity_event WHERE type = 'canvass.visit' AND occurred_at > now() - interval '7 days') AS visits,
			   (SELECT COUNT(*) FROM activity_event WHERE type = 'canvass.visit' AND occurred_at > now() - interval '14 days' AND occurred_at <= now() - interval '7 days') AS visits_before,
			   (SELECT COUNT(*) FROM activity_event WHERE type = 'document.failed' AND occurred_at > now() - interval '24 hours') AS failed_documents`
		),
		timeSeries(POOL, { source: 'users', ...growthWindow }),
		rollingActiveUsers(POOL, { ...growthWindow, windowDays: 1 }),
		Promise.all(
			[1, 7, 30].map((windowDays) => rollingActiveUsers(POOL, { from: now, to: now, granularity: 'day', windowDays }))
		),
		POOL.query<{ id: string; name: string; email: string; created_at: Date }>(
			`SELECT id, name, email, created_at FROM auth.user WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`
		),
		POOL.query<{ id: string; name: string; slug: string; created_at: Date }>(
			`SELECT id, name, slug, created_at FROM auth.organization WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`
		),
		emailLogTotals(7),
		orgSizes(),
		Promise.all([isMailConfigured(), isStorageConfigured().catch(() => false), isMigrationNeeded().catch(() => true), emailLogTotals(1)]),
		getExternalLinks(),
		canInfra(userId, 'audit.read')
	]);

	const c = counts.rows[0];
	const [mailConfigured, storageConfigured, migrationNeeded, emailsToday] = status;

	return {
		users: Number(c.users),
		newUsers7d: { value: Number(c.new_users), previous: Number(c.new_users_before) },
		activeUsers: {
			daily: dau.at(-1)?.value ?? 0,
			weekly: wau.at(-1)?.value ?? 0,
			monthly: mau.at(-1)?.value ?? 0
		},
		organizations: Number(c.orgs),
		activeOrgs30d: Number(c.active_orgs),
		visits7d: { value: Number(c.visits), previous: Number(c.visits_before) },
		emails7d: { sent: emails.sent, failed: emails.failed },
		growth: [
			{ key: 'signups', label: 'New accounts', points: signups },
			{ key: 'active', label: 'Active that day', points: daily }
		],
		orgSizes: sizes,
		recentUsers: users.rows.map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.created_at.toISOString() })),
		recentOrgs: orgs.rows.map((o) => ({ id: o.id, name: o.name, slug: o.slug, createdAt: o.created_at.toISOString() })),
		recentAudit: canAudit ? (await queryAuditPage({}, 1, 5)).items : null,
		status: {
			mailConfigured,
			storageConfigured,
			migrationNeeded,
			failedEmails24h: emailsToday.failed,
			failedDocuments24h: Number(c.failed_documents)
		},
		externalLinks: links
	};
}

/** One user's daily activity over the last 90 days, for their page. 403 without `access`. */
export async function getUserActivitySeries(userId: string, targetId: string) {
	await requireInfraPermission(userId, 'access');
	const now = new Date();
	const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89));
	return [
		{
			key: 'events',
			label: 'Things done',
			points: await timeSeries(POOL, { source: 'activity_events', from, to: now, granularity: 'week', where: { userId: targetId } })
		}
	];
}

/** One org's activity over the last 90 days, for its page. 403 without `access`. */
export async function getOrgActivitySeries(userId: string, orgId: string) {
	await requireInfraPermission(userId, 'access');
	const now = new Date();
	const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89));
	const window = { from, to: now, granularity: 'week' as const };
	const [visits, active] = await Promise.all([
		timeSeries(POOL, { source: 'activity_events', ...window, orgId, where: { type: 'canvass.visit' } }),
		rollingActiveUsers(POOL, { ...window, windowDays: 7, orgId })
	]);
	return [
		{ key: 'visits', label: 'Visits', points: visits },
		{ key: 'active', label: 'Active members', points: active }
	];
}
