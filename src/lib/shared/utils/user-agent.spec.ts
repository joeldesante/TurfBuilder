import { describe, it, expect } from 'vitest';
import { describeUserAgent } from './user-agent';

describe('describeUserAgent', () => {
	it.each([
		[
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
			'Chrome on macOS'
		],
		[
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
			'Safari on iOS'
		],
		['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Windows'],
		[
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
			'Edge on Windows'
		],
		[
			'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
			'Chrome on Android'
		],
		['curl/8.4.0', 'curl']
	])('%s', (ua, label) => {
		expect(describeUserAgent(ua)).toBe(label);
	});

	it('falls back for empty or unknown agents', () => {
		expect(describeUserAgent(null)).toBe('Unknown device');
		expect(describeUserAgent('')).toBe('Unknown device');
		expect(describeUserAgent('SomeBot/1.0')).toBe('Unknown device');
	});
});
