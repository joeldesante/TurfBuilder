const UNITS = [
	{ size: 1_000_000, suffix: 'm' },
	{ size: 1_000, suffix: 'k' }
];

/**
 * Shortens a count for tight spaces: 950, 1k, 65.4k, 73k, 1.2m, 100m. Rounds
 * down to one decimal so a count never reads higher than it is (999,999 is
 * 999.9k, not 1000k).
 */
export function compactNumber(value: number): string {
	for (const { size, suffix } of UNITS) {
		if (value >= size) {
			const tenths = Math.floor((value / size) * 10) / 10;
			return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)}${suffix}`;
		}
	}
	return String(value);
}
