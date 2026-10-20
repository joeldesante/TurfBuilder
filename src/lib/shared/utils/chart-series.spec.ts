import { describe, it, expect } from 'vitest';
import {
	bucketRange,
	bucketStart,
	categoriesToCsv,
	cumulative,
	foldOther,
	percentChange,
	ratioSeries,
	rollingAverage,
	seriesToCsv,
	zeroFill
} from './chart-series';

describe('bucketStart', () => {
	it('starts weeks on Monday, like Postgres', () => {
		expect(bucketStart('2026-10-20', 'week')).toBe('2026-10-19');
		expect(bucketStart('2026-10-25', 'week')).toBe('2026-10-19');
		expect(bucketStart('2026-10-19', 'week')).toBe('2026-10-19');
	});

	it('starts months on the 1st', () => {
		expect(bucketStart('2026-10-20', 'month')).toBe('2026-10-01');
	});

	it('reads date-times in UTC', () => {
		expect(bucketStart(new Date('2026-10-20T23:30:00Z'), 'day')).toBe('2026-10-20');
	});
});

describe('bucketRange', () => {
	it('lists every bucket inclusively', () => {
		expect(bucketRange('2026-10-18', '2026-10-20', 'day')).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
		expect(bucketRange('2026-01-31', '2026-03-02', 'month')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
	});

	it('is empty when the range is backwards', () => {
		expect(bucketRange('2026-10-20', '2026-10-18', 'day')).toEqual([]);
	});
});

describe('zeroFill', () => {
	it('fills gaps with zero and sums points into their bucket', () => {
		expect(
			zeroFill(
				[
					{ date: '2026-10-19', value: 2 },
					{ date: '2026-10-21', value: 3 },
					{ date: '2026-10-22', value: 1 }
				],
				'2026-10-19',
				'2026-10-27',
				'week'
			)
		).toEqual([
			{ date: '2026-10-19', value: 6 },
			{ date: '2026-10-26', value: 0 }
		]);
	});
});

describe('transforms', () => {
	const points = [
		{ date: '2026-10-01', value: 2 },
		{ date: '2026-10-02', value: 4 },
		{ date: '2026-10-03', value: 6 }
	];

	it('cumulative adds up from a starting total', () => {
		expect(cumulative(points, 10).map((p) => p.value)).toEqual([12, 16, 22]);
	});

	it('rollingAverage averages a trailing window', () => {
		expect(rollingAverage(points, 2).map((p) => p.value)).toEqual([2, 3, 5]);
	});

	it('ratioSeries divides bucket by bucket and avoids dividing by zero', () => {
		expect(ratioSeries(points, [{ date: '2026-10-01', value: 4 }]).map((p) => p.value)).toEqual([0.5, 0, 0]);
	});

	it('percentChange is null when there was nothing before', () => {
		expect(percentChange(15, 10)).toBe(0.5);
		expect(percentChange(0, 0)).toBe(0);
		expect(percentChange(3, 0)).toBeNull();
	});
});

describe('CSV', () => {
	it('puts each series in its own column', () => {
		expect(
			seriesToCsv([
				{ key: 'a', label: 'Sign-ups', points: [{ date: '2026-10-01', value: 1 }] },
				{ key: 'b', label: 'Active, daily', points: [{ date: '2026-10-02', value: 2 }] }
			])
		).toBe('date,Sign-ups,"Active, daily"\n2026-10-01,1,\n2026-10-02,,2');
	});

	it('neutralizes spreadsheet formulas in labels', () => {
		expect(categoriesToCsv([{ key: 'x', label: '=HYPERLINK("x")', value: 1 }])).toBe(`label,value\n"'=HYPERLINK(""x"")",1`);
	});
});

describe('foldOther', () => {
	it('keeps the largest and sums the rest', () => {
		const data = ['a', 'b', 'c', 'd'].map((k, i) => ({ key: k, label: k, value: 10 - i }));
		expect(foldOther(data, 3).map((d) => [d.label, d.value])).toEqual([
			['a', 10],
			['b', 9],
			['Other', 15]
		]);
	});

	it('leaves short lists alone', () => {
		expect(foldOther([{ key: 'a', label: 'a', value: 1 }], 3)).toHaveLength(1);
	});
});
