import type { CategoryDatum, MatrixCell, TimePoint, TimeSeries } from '$lib/shared/types/charts';
import { bucketRange } from '$lib/shared/utils/chart-series';

/** A repeatable wave with weekly rhythm, so stories and specs see the same data every time. */
export function wave(days: number, base: number, swing: number, seed = 1, start = '2026-08-01'): TimePoint[] {
	const end = new Date(Date.parse(`${start}T00:00:00Z`) + (days - 1) * 86_400_000);
	return bucketRange(start, end, 'day').map((date, i) => ({
		date,
		value: Math.max(0, Math.round(base + swing * Math.sin((i + seed) / 3.5) + ((i * 7 + seed * 13) % 5)))
	}));
}

export const signups: TimeSeries[] = [{ key: 'signups', label: 'New accounts', points: wave(60, 24, 10) }];

export const activeUsers: TimeSeries[] = [
	{ key: 'dau', label: 'Daily active', points: wave(60, 120, 30, 2) },
	{ key: 'wau', label: 'Weekly active', points: wave(60, 410, 40, 3) },
	{ key: 'mau', label: 'Monthly active', points: wave(60, 900, 25, 4) }
];

export const visitsStack: TimeSeries[] = [
	{ key: 'contact', label: 'Talked to someone', points: wave(14, 60, 20, 1) },
	{ key: 'no_contact', label: 'No answer', points: wave(14, 110, 30, 5) }
];

export const topOrgs: CategoryDatum[] = [
	{ key: 'a', label: 'Riverside Canvass', value: 2140 },
	{ key: 'b', label: 'Northside Tenants Union', value: 1630 },
	{ key: 'c', label: 'Hill District Votes', value: 990 },
	{ key: 'd', label: 'Old Town', value: 410 },
	{ key: 'e', label: 'Lakeview Neighbors for Better Transit', value: 120 }
];

export const signInMethods: CategoryDatum[] = [
	{ key: 'credential', label: 'Email and password', value: 812 },
	{ key: 'google', label: 'Google', value: 233 },
	{ key: 'two_factor', label: 'With two-factor', value: 97 }
];

export const longTail: CategoryDatum[] = [
	'Visited', 'Signed in', 'Joined', 'Submitted a survey', 'Created a list', 'Cut a turf', 'Generated a PDF', 'Signed up', 'Left'
].map((label, i) => ({ key: label, label, value: 900 - i * 90 }));

/** Weekly sign-up cohorts by weeks since joining; later weeks are unknown yet, so null. */
export const cohortRows = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'];
export const cohortCols = ['0', '1', '2', '3', '4'];
export const cohortCells: MatrixCell[] = cohortRows.flatMap((row, ri) =>
	cohortCols.map((col, ci) => ({
		row,
		col,
		value: ci > cohortRows.length - 1 - ri ? null : ci === 0 ? 1 : Math.max(0.05, 0.62 - ci * 0.11 - ri * 0.02)
	}))
);
