const DAY_MS = 86_400_000;

/** "Oct 20, 2026" for an ISO date or date-time; an em dash for none. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Oct 20, 2026, 3:04 PM" for an ISO date-time; an em dash for none. */
export function formatDateTime(value: string | null | undefined): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

/**
 * How long ago a day (YYYY-MM-DD) or date-time was, in whole days: "Today",
 * "Yesterday", "5 days ago", then the date. "Never" for none.
 */
export function formatDaysAgo(value: string | null | undefined, now: Date = new Date()): string {
	if (!value) return 'Never';
	const then = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
	if (Number.isNaN(then.getTime())) return 'Never';

	const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
	if (days <= 0) return 'Today';
	if (days === 1) return 'Yesterday';
	if (days < 30) return `${days} days ago`;
	return formatDate(value);
}
