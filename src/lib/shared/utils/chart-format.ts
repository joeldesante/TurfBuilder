import type { Granularity, ValueFormat } from '$lib/shared/types/charts';
import { compactNumber } from './compact-number';

/** A value as the chart should print it. */
export function formatValue(value: number, format: ValueFormat = 'number'): string {
	if (!Number.isFinite(value)) return '—';
	switch (format) {
		case 'percent':
			return `${(value * 100).toFixed(value !== 0 && Math.abs(value) < 0.1 ? 1 : 0)}%`;
		case 'compact':
			return value < 0 ? `-${compactNumber(-value)}` : compactNumber(Math.round(value));
		case 'duration':
			return formatDuration(value);
		default:
			return Number.isInteger(value)
				? value.toLocaleString('en-US')
				: value.toLocaleString('en-US', { maximumFractionDigits: 1 });
	}
}

/** Seconds as "45s", "12m", "3h 5m", or "2d 4h". */
export function formatDuration(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
	const d = Math.floor(h / 24);
	return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A bucket's date (YYYY-MM-DD) as an axis label: "Oct 20", "Week of Oct 19", or "Oct 2026". */
export function formatBucket(date: string, granularity: Granularity, long = false): string {
	const [y, m, d] = date.slice(0, 10).split('-').map(Number);
	const month = MONTHS[m - 1] ?? '';
	if (granularity === 'month') return `${month} ${y}`;
	if (granularity === 'week' && long) return `Week of ${month} ${d}, ${y}`;
	return long ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

/** A signed change, such as "+12%" or "-3%"; "New" when there was nothing before. */
export function formatChange(change: number | null): string {
	if (change === null) return 'New';
	const pct = Math.round(change * 100);
	return `${pct > 0 ? '+' : ''}${pct}%`;
}
