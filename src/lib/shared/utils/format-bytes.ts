const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** A byte count as "812 B", "1.4 MB", or "12 GB": one decimal under 10, none above. */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	const text = unit === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
	return `${text} ${UNITS[unit]}`;
}
