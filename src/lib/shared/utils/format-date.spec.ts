import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatDaysAgo } from './format-date';

describe('formatDate', () => {
	it('formats dates and date-times', () => {
		expect(formatDate('2026-10-20')).toBe('Oct 20, 2026');
		expect(formatDate('2026-10-20T15:04:00')).toBe('Oct 20, 2026');
	});

	it('shows a dash for nothing', () => {
		expect(formatDate(null)).toBe('—');
		expect(formatDate('not a date')).toBe('—');
	});
});

describe('formatDateTime', () => {
	it('includes the time', () => {
		expect(formatDateTime('2026-10-20T15:04:00')).toBe('Oct 20, 2026, 3:04 PM');
	});
});

describe('formatDaysAgo', () => {
	const now = new Date('2026-10-20T12:00:00');

	it('counts whole days', () => {
		expect(formatDaysAgo('2026-10-20', now)).toBe('Today');
		expect(formatDaysAgo('2026-10-19', now)).toBe('Yesterday');
		expect(formatDaysAgo('2026-10-15', now)).toBe('5 days ago');
	});

	it('switches to the date after a month', () => {
		expect(formatDaysAgo('2026-08-01', now)).toBe('Aug 1, 2026');
	});

	it('says never for nothing', () => {
		expect(formatDaysAgo(null, now)).toBe('Never');
	});
});
