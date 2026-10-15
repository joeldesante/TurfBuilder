import { describe, expect, it } from 'vitest';
import { compactNumber } from './compact-number';

describe('compactNumber', () => {
	it('leaves numbers under a thousand alone', () => {
		expect(compactNumber(0)).toBe('0');
		expect(compactNumber(999)).toBe('999');
	});

	it('abbreviates thousands to at most one decimal', () => {
		expect(compactNumber(1000)).toBe('1k');
		expect(compactNumber(1023)).toBe('1k');
		expect(compactNumber(65_400)).toBe('65.4k');
		expect(compactNumber(73_000)).toBe('73k');
		expect(compactNumber(100_000)).toBe('100k');
	});

	it('abbreviates millions', () => {
		expect(compactNumber(1_200_000)).toBe('1.2m');
		expect(compactNumber(100_000_000)).toBe('100m');
	});

	it('rounds down so a count never reads higher than it is', () => {
		expect(compactNumber(999_999)).toBe('999.9k');
		expect(compactNumber(65_460)).toBe('65.4k');
	});
});
