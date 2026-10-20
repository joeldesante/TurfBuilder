import { describe, it, expect } from 'vitest';
import { formatBucket, formatChange, formatDuration, formatValue } from './chart-format';

describe('formatValue', () => {
	it('formats each kind', () => {
		expect(formatValue(12345)).toBe('12,345');
		expect(formatValue(12.345)).toBe('12.3');
		expect(formatValue(65_432, 'compact')).toBe('65.4k');
		expect(formatValue(0.257, 'percent')).toBe('26%');
		expect(formatValue(0.042, 'percent')).toBe('4.2%');
		expect(formatValue(3700, 'duration')).toBe('1h 1m');
	});

	it('shows a dash for nonsense', () => {
		expect(formatValue(Number.NaN)).toBe('—');
	});
});

describe('formatDuration', () => {
	it('picks the largest sensible units', () => {
		expect(formatDuration(45)).toBe('45s');
		expect(formatDuration(720)).toBe('12m');
		expect(formatDuration(3 * 3600)).toBe('3h');
		expect(formatDuration(52 * 3600)).toBe('2d 4h');
	});
});

describe('formatBucket', () => {
	it('labels by granularity', () => {
		expect(formatBucket('2026-10-19', 'day')).toBe('Oct 19');
		expect(formatBucket('2026-10-19', 'week', true)).toBe('Week of Oct 19, 2026');
		expect(formatBucket('2026-10-01', 'month')).toBe('Oct 2026');
	});
});

describe('formatChange', () => {
	it('signs the change', () => {
		expect(formatChange(0.12)).toBe('+12%');
		expect(formatChange(-0.034)).toBe('-3%');
		expect(formatChange(0)).toBe('0%');
		expect(formatChange(null)).toBe('New');
	});
});
