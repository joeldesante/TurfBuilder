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
	const text =
		unit === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
	return `${text} ${UNITS[unit]}`;
}

/** A byte count in megabytes, always: "0.12 MB", "3.4 MB", "48 MB". Under 0.01 MB reads "<0.01 MB". */
export function formatMegabytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
	const mb = bytes / 1_048_576;
	if (mb < 0.01) return '<0.01 MB';
	const text = mb >= 10 ? Math.round(mb).toString() : mb.toFixed(2).replace(/\.?0+$/, '');
	return `${text} MB`;
}
