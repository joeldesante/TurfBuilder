import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
	it.each([
		[0, '0 B'],
		[812, '812 B'],
		[1024, '1 KB'],
		[1536, '1.5 KB'],
		[10 * 1024 * 1024, '10 MB'],
		[Math.round(1.4 * 1024 * 1024), '1.4 MB'],
		[12 * 1024 ** 3, '12 GB'],
		[3 * 1024 ** 5, '3072 TB']
	])('formats %i as %s', (bytes, text) => {
		expect(formatBytes(bytes)).toBe(text);
	});

	it('treats bad input as zero', () => {
		expect(formatBytes(-5)).toBe('0 B');
		expect(formatBytes(NaN)).toBe('0 B');
	});
});
