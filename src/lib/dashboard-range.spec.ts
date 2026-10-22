import { describe, it, expect } from 'vitest';
import { parseRange, rangeInterval, rangeLabel, rangeStart } from './dashboard-range';

const now = new Date('2026-10-20T15:30:00Z');

describe('parseRange', () => {
	it('keeps valid ranges and falls back to all time', () => {
		expect(parseRange('30d')).toBe('30d');
		expect(parseRange('nonsense')).toBe('all');
		expect(parseRange(null)).toBe('all');
	});
});

describe('rangeInterval and rangeLabel', () => {
	it('describe the range', () => {
		expect(rangeInterval('7d')).toBe('7 days');
		expect(rangeInterval('all')).toBeNull();
		expect(rangeLabel('1y')).toBe('Last year');
		expect(rangeLabel('30d')).toBe('Last 30 days');
	});
});

describe('rangeStart', () => {
	it('counts days including today', () => {
		expect(rangeStart('7d', now)?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
		expect(rangeStart('1d', now)?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
	});

	it('counts weeks, months, and years back to the day after', () => {
		expect(rangeStart('1w', now)?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
		expect(rangeStart('3m', now)?.toISOString()).toBe('2026-07-21T00:00:00.000Z');
		expect(rangeStart('1y', now)?.toISOString()).toBe('2025-10-21T00:00:00.000Z');
	});

	it('counts hours exactly', () => {
		expect(rangeStart('24h', now)?.toISOString()).toBe('2026-10-19T15:30:00.000Z');
	});

	it('is null for all time', () => {
		expect(rangeStart('all', now)).toBeNull();
	});
});
