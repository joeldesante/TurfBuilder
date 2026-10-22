/**
 * A short, readable label for a user agent string, such as "Chrome on macOS".
 * Good enough to tell a person's devices apart; not a full parser.
 */
export function describeUserAgent(userAgent: string | null | undefined): string {
	if (!userAgent) return 'Unknown device';
	const ua = userAgent;

	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\/|Opera/.test(ua)
			? 'Opera'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\/|CriOS\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: /curl\//i.test(ua)
							? 'curl'
							: null;

	const os = /iPhone|iPad|iPod/.test(ua)
		? 'iOS'
		: /Android/.test(ua)
			? 'Android'
			: /Mac OS X|Macintosh/.test(ua)
				? 'macOS'
				: /Windows/.test(ua)
					? 'Windows'
					: /CrOS/.test(ua)
						? 'ChromeOS'
						: /Linux/.test(ua)
							? 'Linux'
							: null;

	if (browser && os) return `${browser} on ${os}`;
	return browser ?? os ?? 'Unknown device';
}
