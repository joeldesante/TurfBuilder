/** 'all', or a number and a unit: 24h, 27d, 6w, 3m, 1y. */
export type DashboardRange = string;

const UNITS = {
	h: { sql: 'hours', one: 'hour', many: 'hours', max: 9999 },
	d: { sql: 'days', one: 'day', many: 'days', max: 9999 },
	w: { sql: 'weeks', one: 'week', many: 'weeks', max: 5200 },
	m: { sql: 'months', one: 'month', many: 'months', max: 1200 },
	y: { sql: 'years', one: 'year', many: 'years', max: 100 }
} as const;

type Unit = keyof typeof UNITS;

const PATTERN = /^([1-9]\d{0,3})([hdwmy])$/;

function parts(range: string): { amount: number; unit: Unit } | null {
	const match = PATTERN.exec(range);
	if (!match) return null;
	const amount = Number(match[1]);
	const unit = match[2] as Unit;
	// About 100 years at most: much further back overflows a Postgres timestamp.
	return amount <= UNITS[unit].max ? { amount, unit } : null;
}

/** Reads ?range=; anything missing or not in the <number><unit> form is all time. */
export function parseRange(value: string | null): DashboardRange {
	return value && parts(value) ? value : 'all';
}

/** The range as a Postgres interval, e.g. '27 days', or null for all time. */
export function rangeInterval(range: DashboardRange): string | null {
	const p = parts(range);
	return p ? `${p.amount} ${UNITS[p.unit].sql}` : null;
}

/** 'Last 27 days', 'Last hour', or 'All time'. */
export function rangeLabel(range: DashboardRange): string {
	const p = parts(range);
	if (!p) return 'All time';
	const u = UNITS[p.unit];
	return p.amount === 1 ? `Last ${u.one}` : `Last ${p.amount} ${u.many}`;
}
