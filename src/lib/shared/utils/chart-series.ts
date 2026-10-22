import type { CategoryDatum, Granularity, TimePoint, TimeSeries } from '$lib/shared/types/charts';

const DAY_MS = 86_400_000;

function toUtcDate(value: string | Date): Date {
	if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
	return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

function iso(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** The first day of the bucket holding `date`: the day, its Monday, or the 1st of its month (UTC). */
export function bucketStart(date: string | Date, granularity: Granularity): string {
	const d = toUtcDate(date);
	if (granularity === 'week') {
		const sinceMonday = (d.getUTCDay() + 6) % 7;
		return iso(new Date(d.getTime() - sinceMonday * DAY_MS));
	}
	if (granularity === 'month') return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
	return iso(d);
}

/** Every bucket from the one holding `from` to the one holding `to`, inclusive. */
export function bucketRange(from: string | Date, to: string | Date, granularity: Granularity): string[] {
	const out: string[] = [];
	let cursor = toUtcDate(bucketStart(from, granularity));
	const end = toUtcDate(bucketStart(to, granularity));
	// A hard stop, so a bad range cannot build an unbounded array.
	for (let i = 0; cursor <= end && i < 5000; i++) {
		out.push(iso(cursor));
		if (granularity === 'day') cursor = new Date(cursor.getTime() + DAY_MS);
		else if (granularity === 'week') cursor = new Date(cursor.getTime() + 7 * DAY_MS);
		else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
	}
	return out;
}

/**
 * The points with every missing bucket between `from` and `to` filled with
 * zero, in order. Points already bucketed differently are re-bucketed and summed.
 */
export function zeroFill(points: TimePoint[], from: string | Date, to: string | Date, granularity: Granularity): TimePoint[] {
	const totals = new Map<string, number>();
	for (const p of points) {
		const key = bucketStart(p.date, granularity);
		totals.set(key, (totals.get(key) ?? 0) + p.value);
	}
	return bucketRange(from, to, granularity).map((date) => ({ date, value: totals.get(date) ?? 0 }));
}

/** A running total, starting from `start` (such as the count before the range began). */
export function cumulative(points: TimePoint[], start = 0): TimePoint[] {
	let total = start;
	return points.map((p) => ({ date: p.date, value: (total += p.value) }));
}

/** The mean of each point and the `window - 1` before it; shorter at the start. */
export function rollingAverage(points: TimePoint[], window: number): TimePoint[] {
	const size = Math.max(1, Math.floor(window));
	return points.map((p, i) => {
		const slice = points.slice(Math.max(0, i - size + 1), i + 1);
		return { date: p.date, value: slice.reduce((sum, q) => sum + q.value, 0) / slice.length };
	});
}

/** One series divided by another, bucket by bucket (DAU / MAU); zero where the divisor is. */
export function ratioSeries(numerator: TimePoint[], denominator: TimePoint[]): TimePoint[] {
	const below = new Map(denominator.map((p) => [p.date, p.value]));
	return numerator.map((p) => {
		const d = below.get(p.date) ?? 0;
		return { date: p.date, value: d === 0 ? 0 : p.value / d };
	});
}

/** The change from `previous` to `current` as a fraction (0.25 is up 25%); null when there was nothing before. */
export function percentChange(current: number, previous: number): number | null {
	if (previous === 0) return current === 0 ? 0 : null;
	return (current - previous) / previous;
}

function csvCell(value: string | number): string {
	const text = String(value);
	// Quote anything with a delimiter, and neutralize leading formula characters for spreadsheets.
	const safe = /^[=+\-@\t\r]/.test(text) && typeof value === 'string' ? `'${text}` : text;
	return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Series as CSV: a date column, then one column per series. */
export function seriesToCsv(series: TimeSeries[]): string {
	const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
	const lookup = series.map((s) => new Map(s.points.map((p) => [p.date, p.value])));
	const rows = [['date', ...series.map((s) => s.label)].map(csvCell).join(',')];
	for (const date of dates) {
		rows.push([date, ...lookup.map((m) => m.get(date) ?? '')].map(csvCell).join(','));
	}
	return rows.join('\n');
}

/** Categories as CSV: label and value. */
export function categoriesToCsv(data: CategoryDatum[], valueLabel = 'value'): string {
	return [['label', valueLabel].map(csvCell).join(','), ...data.map((d) => [d.label, d.value].map(csvCell).join(','))].join(
		'\n'
	);
}

/**
 * The largest `keep - 1` categories, then the rest summed into one "Other",
 * so a long tail never needs a ninth color.
 */
export function foldOther(data: CategoryDatum[], keep: number, label = 'Other'): CategoryDatum[] {
	const sorted = [...data].sort((a, b) => b.value - a.value);
	if (sorted.length <= keep) return sorted;
	const head = sorted.slice(0, keep - 1);
	const rest = sorted.slice(keep - 1).reduce((sum, d) => sum + d.value, 0);
	return [...head, { key: '__other', label, value: rest, color: 'var(--chart-other)' }];
}
