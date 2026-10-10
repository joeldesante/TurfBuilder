import type { FilterOperation } from './filters';

export type FilterCategory = 'geographical' | 'survey' | 'meta';

/** The kind of value a filter compares against, which decides the input the UI shows. */
export type FilterValueType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'radius' | 'polygon' | 'survey_response';

export interface FilterRegistryEntry {
	/** Stable identifier; stored in saved filters, so never rename one. */
	id: string;
	name: string;
	description: string;
	category: FilterCategory;
	valueType: FilterValueType;
	/** Operations this filter supports. */
	operations: FilterOperation[];
	/** Choices for a `select` value type. */
	options?: { value: string; label: string }[];
	/** Short unit shown after the value, e.g. "miles". */
	unit?: string;
}
