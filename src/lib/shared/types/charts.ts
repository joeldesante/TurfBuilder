/**
 * The data shapes the chart library draws. Server services return these, so a
 * query's output feeds a chart directly. Dates are strings so they survive
 * page data and JSON unchanged.
 */

/** How time is bucketed. Weeks start on Monday, as Postgres date_trunc('week') does. */
export type Granularity = 'day' | 'week' | 'month';

export interface TimePoint {
	/** The bucket's first day, YYYY-MM-DD (UTC). */
	date: string;
	value: number;
}

export interface TimeSeries {
	key: string;
	label: string;
	points: TimePoint[];
	/** A CSS color; defaults to the next categorical slot. */
	color?: string;
	/** Drawn dashed, for a comparison such as the previous period. */
	dashed?: boolean;
}

export interface CategoryDatum {
	key: string;
	label: string;
	value: number;
	color?: string;
}

/** One cell of a heatmap. A null value means no data, which is drawn apart from zero. */
export interface MatrixCell {
	row: string;
	col: string;
	value: number | null;
}

/** How a value should read: a count, a share, or a length of time. */
export type ValueFormat = 'number' | 'compact' | 'percent' | 'duration';
