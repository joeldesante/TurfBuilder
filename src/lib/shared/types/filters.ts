export type FilterOperation =
	| 'equals'
	| 'not_equals'
	| 'greater_than'
	| 'less_than'
	| 'greater_than_or_equal'
	| 'less_than_or_equal'
	| 'contains'
	| 'starts_with'
	| 'in'
	| 'within'
	| 'not_within';

/** Value of a radius filter: a point and a distance around it, in miles. */
export interface RadiusValue {
	latitude: number;
	longitude: number;
	radius: number;
}

/** Value of a survey response filter: the question picked through its bucket and survey, and the response sought. */
export interface SurveyResponseValue {
	bucketId: string;
	surveyId: string;
	questionId: string;
	/** The choice or text to match; empty until one is chosen. */
	response: string;
}

export interface Filter {
	/** How the selected item is compared against the value. */
	operation: FilterOperation;
	/** The item the user is filtering on (e.g. a question or field identifier). */
	item: string;
	/** The value to compare against; its type depends on the item and operation. */
	value: unknown;
	/** For text matching only: whether letter case must match. Absent means it does not. */
	caseSensitive?: boolean;
}

export type FilterGroupOperator = 'AND' | 'OR';

export interface FilterGroup {
	/** How the results of the entries are combined. */
	operator: FilterGroupOperator;
	/** Filters or nested groups, so conditions can be arbitrarily nested. */
	filters: (Filter | FilterGroup)[];
}

