/** The categorical color for the series at `index`: slots in order, never cycled. */
export function seriesColor(index: number, explicit?: string): string {
	if (explicit) return explicit;
	return index < 8 ? `var(--chart-${index + 1})` : 'var(--chart-other)';
}

/** A YYYY-MM-DD bucket as a UTC Date, for d3 time scales. */
export function bucketDate(date: string): Date {
	return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

/** Starts a download of `csv` as `filename` in the browser. */
export function downloadCsv(filename: string, csv: string): void {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Spreads end-of-line labels so none overlap: sorted by y, each at least `gap`
 * below the one above, then pulled back up if the last ran past `max`.
 */
export function spreadLabels<T extends { y: number }>(labels: T[], gap: number, max: number): (T & { labelY: number })[] {
	const sorted = [...labels].sort((a, b) => a.y - b.y).map((l) => ({ ...l, labelY: l.y }));
	for (let i = 1; i < sorted.length; i++) {
		sorted[i].labelY = Math.max(sorted[i].labelY, sorted[i - 1].labelY + gap);
	}
	const overflow = (sorted.at(-1)?.labelY ?? 0) - max;
	if (overflow > 0) {
		for (const label of sorted) label.labelY -= overflow;
		for (let i = sorted.length - 2; i >= 0; i--) {
			sorted[i].labelY = Math.min(sorted[i].labelY, sorted[i + 1].labelY - gap);
		}
	}
	return sorted;
}

/** Whether the viewer asked for less motion. */
export function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
