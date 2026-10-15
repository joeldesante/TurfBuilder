import type { FilterOperation } from './filters';

export type FilterCategory = 'geographical' | 'survey' | 'canvassing' | 'meta';

/** The kind of value a filter compares against, which decides the input the UI shows. */
export type FilterValueType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'radius' | 'polygon' | 'survey_response' | 'contact_made';

export interface FilterRegistryEntry {
	/** Stable identifier; stored in saved filters, so never rename one. */
	id: string;
	name: string;
	description: string;
	category: FilterCategory;
	valueType: FilterValueType;
	/**
	 * How the filter reads as a sentence once configured. `{entity}` is the kind
	 * of record being selected and `{operation}` the chosen operation; the rest
	 * are named parts of the value, which depend on the value type:
	 *
	 * - text, number, date, boolean, select: `{value}`
	 * - radius: `{radius}`, `{point}`
	 * - polygon: `{region}`
	 * - survey_response: `{question}`, `{survey}`, `{response}`
	 * - contact_made: `{outcome}`, `{attempt}`, `{scope}`, `{range}`
	 *
	 * `{value}` is also available for every type and stands for all of its parts.
	 *
	 * A `\n` ends a clause. On a wide screen it reads as a space; on a phone each
	 * clause starts its own line, so break where the sentence would pause.
	 */
	sentence: string;
	/** Operations this filter supports. */
	operations: FilterOperation[];
	/** Replaces the default phrase for an operation where the sentence needs different wording. */
	operationLabels?: Partial<Record<FilterOperation, string>>;
	/** What a boolean value reads as in the sentence. Defaults to "yes" and "no". */
	booleanLabels?: { true: string; false: string };
	/** Choices for a `select` value type. */
	options?: { value: string; label: string }[];
	/** Short unit shown after the value, e.g. "miles". */
	unit?: string;
}
