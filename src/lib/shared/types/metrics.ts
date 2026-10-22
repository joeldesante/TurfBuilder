import type { CategoryDatum, Granularity, MatrixCell, TimeSeries, ValueFormat } from './charts';
import type { DashboardRange } from '$lib/dashboard-range';
import type { AuditEntry } from './audit';
import type { ExternalLink } from './infra';

/** Every chart on the metrics page, by the key the API serves it under. */
export const PLATFORM_METRICS = [
	'signups',
	'total_users',
	'new_orgs',
	'active_users',
	'stickiness',
	'sign_ins',
	'visits',
	'surveys',
	'content',
	'emails',
	'top_orgs',
	'event_mix',
	'two_factor',
	'email_verified',
	'sign_in_methods',
	'org_sizes',
	'retention'
] as const;

export type PlatformMetricKey = (typeof PLATFORM_METRICS)[number];

export type MetricResult =
	| { kind: 'series'; title: string; format: ValueFormat; series: TimeSeries[] }
	| { kind: 'categories'; title: string; format: ValueFormat; data: CategoryDatum[] }
	| { kind: 'matrix'; title: string; format: ValueFormat; cells: MatrixCell[]; rows: string[]; cols: string[] };

export interface MetricsWindow {
	range: DashboardRange;
	granularity: Granularity;
	/** ISO date-times the charts cover. */
	from: string;
	to: string;
}

export type PlatformMetrics = { window: MetricsWindow } & Record<PlatformMetricKey, MetricResult>;

/** A figure with the same figure for the period before, for a stat tile. */
export interface Comparison {
	value: number;
	previous: number;
}

export interface OverviewStatus {
	mailConfigured: boolean;
	storageConfigured: boolean;
	migrationNeeded: boolean;
	failedEmails24h: number;
	failedDocuments24h: number;
}

export interface PlatformOverview {
	users: number;
	newUsers7d: Comparison;
	activeUsers: { daily: number; weekly: number; monthly: number };
	organizations: number;
	activeOrgs30d: number;
	visits7d: Comparison;
	emails7d: { sent: number; failed: number };
	/** Daily sign-ups and daily active users over the last 30 days. */
	growth: TimeSeries[];
	orgSizes: CategoryDatum[];
	recentUsers: { id: string; name: string; email: string; createdAt: string }[];
	recentOrgs: { id: string; name: string; slug: string; createdAt: string }[];
	/** Null when the viewer cannot read the audit log. */
	recentAudit: AuditEntry[] | null;
	status: OverviewStatus;
	externalLinks: ExternalLink[];
}
