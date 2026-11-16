import { describe, expect, it } from 'vitest';
import { formatBytes, formatMegabytes } from './format-bytes';

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

describe('formatMegabytes', () => {
	it('always speaks in megabytes', () => {
		expect(formatMegabytes(1_048_576)).toBe('1 MB');
		expect(formatMegabytes(3_670_016)).toBe('3.5 MB');
		expect(formatMegabytes(125_829_120)).toBe('120 MB');
	});

	it('keeps up to two decimals under 10 MB and none above', () => {
		expect(formatMegabytes(1_300_000)).toBe('1.24 MB');
		expect(formatMegabytes(12_000_000)).toBe('11 MB');
	});

	it('says under 0.01 MB for a tiny file', () => {
		expect(formatMegabytes(4)).toBe('<0.01 MB');
	});

	it('says 0 MB for nothing or nonsense', () => {
		expect(formatMegabytes(0)).toBe('0 MB');
		expect(formatMegabytes(-5)).toBe('0 MB');
		expect(formatMegabytes(Number.NaN)).toBe('0 MB');
	});
});
