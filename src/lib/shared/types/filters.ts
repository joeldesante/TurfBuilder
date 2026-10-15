/** The kind of record a filter selects. */
export type FilterEntity = 'people' | 'locations';

export type FilterOperation =
	| 'equals'
	| 'not_equals'
	| 'greater_than'
	| 'less_than'
	| 'greater_than_or_equal'
	| 'less_than_or_equal'
	| 'contains'
	| 'starts_with'
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

/** Which of a location's canvassing attempts a filter looks at. */
export interface AttemptScope {
	/** `any`: every attempt counts. `latest`: only the most recent. `nth_from_last`: only the `n`th most recent. */
	position: 'any' | 'latest' | 'nth_from_last';
	/** For `nth_from_last` only (2 is the attempt before the latest); null otherwise. */
	n: number | null;
	/** Only attempts on turfs cut from lists in this bucket; null for any. */
	bucketId: string | null;
	/** Only attempts on turfs cut from this list; null for any. */
	listId: string | null;
	/** Only attempts made on or after this date (YYYY-MM-DD); null for no start. */
	from: string | null;
	/** Only attempts made on or before this date (YYYY-MM-DD); null for no end. */
	to: string | null;
}

/** Value of a contact made filter: whether the attempts in scope reached someone. */
export interface ContactMadeValue extends AttemptScope {
	/** True to find attempts where contact was made, false to find attempts where it was not. */
	contacted: boolean;
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
	/**
	 * Inverts the group: with OR, none of the entries match; with AND, not all
	 * of them do. Absent means not inverted. An empty group places no
	 * restriction either way.
	 */
	not?: boolean;
	/** Filters or nested groups, so conditions can be arbitrarily nested. */
	filters: (Filter | FilterGroup)[];
}


/**
 * A bucket's filters: one document per kind of record, or null when the bucket
 * does not include that kind. An empty group includes every record of the kind.
 */
export interface BucketFilters {
	v: 2;
	people: FilterGroup | null;
	locations: FilterGroup | null;
}
