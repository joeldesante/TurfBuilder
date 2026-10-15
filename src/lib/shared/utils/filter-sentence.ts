import type { FilterRegistryEntry } from '../types/filter-registry';
import type {
	ContactMadeValue,
	Filter,
	FilterEntity,
	RadiusValue,
	SurveyResponseValue
} from '../types/filters';
import { FILTER_OPERATION_LABELS } from './filters';

/** One run of a filter's sentence: plain words, or a highlighted value. */
export interface SentencePart {
	text: string;
	/** Shown as a badge, for the words that carry the filter's settings. */
	badge?: boolean;
	/** The setting is missing or invalid; drawn so it stands out. */
	incomplete?: boolean;
	/** Marks a part that can be viewed on a map. */
	view?: 'radius' | 'polygon';
	/** Ends a clause. Reads as a space, but on a phone the next clause starts a new line. */
	break?: boolean;
}

/** Names for the ids in a value, which the filter does not hold. Unresolved ids read generically. */
export interface SentenceNames {
	bucket?: string;
	list?: string;
	survey?: string;
	question?: string;
}

export interface DescribeOptions {
	/** Reads as "records" when the kind of record is not known. */
	entity?: FilterEntity;
	names?: SentenceNames;
}

type Parts = Record<string, SentencePart[]>;

const text = (value: string): SentencePart => ({ text: value });
const badge = (value: string, extra: Partial<SentencePart> = {}): SentencePart => ({
	text: value,
	badge: true,
	...extra
});
const clauseBreak = (): SentencePart => ({ text: ' ', break: true });
/** A badge standing in for a setting that has not been given yet. */
const missing = (label: string): SentencePart => badge(label, { incomplete: true });

const ENTITY_NAMES: Record<FilterEntity, string> = { people: 'People', locations: 'Locations' };

/** The kind of record as the editor names it: "People", "Locations", or "Records" when not known. */
export function entityName(entity?: FilterEntity): string {
	return entity ? ENTITY_NAMES[entity] : 'Records';
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

/** "2026-01-05" as "Jan 5, 2026". Read in UTC so the day never shifts with the viewer's time zone. */
export function formatDate(iso: string): string {
	const date = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString('en-US', {
		timeZone: 'UTC',
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function ordinal(n: number): string {
	const rest = n % 100;
	if (rest >= 11 && rest <= 13) return `${n}th`;
	return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

// ---------------------------------------------------------------------------
// The parts of a value, by value type
// ---------------------------------------------------------------------------

function textParts(filter: Filter): Parts {
	const value = typeof filter.value === 'string' ? filter.value : '';
	if (!value) return { value: [missing('no text yet')] };
	const parts = [badge(value)];
	if (filter.caseSensitive) parts.push(text(' (match case)'));
	return { value: parts };
}

function numberParts(filter: Filter, entry: FilterRegistryEntry): Parts {
	if (typeof filter.value !== 'number' || !Number.isFinite(filter.value)) {
		return { value: [missing('no number yet')] };
	}
	return { value: [badge(entry.unit ? `${filter.value} ${entry.unit}` : String(filter.value))] };
}

function dateParts(filter: Filter): Parts {
	return typeof filter.value === 'string' && filter.value
		? { value: [badge(formatDate(filter.value))] }
		: { value: [missing('no date yet')] };
}

function booleanParts(filter: Filter, entry: FilterRegistryEntry): Parts {
	const labels = entry.booleanLabels ?? { true: 'yes', false: 'no' };
	return { value: [badge(filter.value === true ? labels.true : labels.false)] };
}

function selectParts(filter: Filter, entry: FilterRegistryEntry): Parts {
	const option = entry.options?.find((o) => o.value === filter.value);
	return { value: [option ? badge(option.label) : missing('nothing chosen')] };
}

function radiusParts(filter: Filter): Parts {
	const v = filter.value;
	if (
		!isObject(v) ||
		typeof v.latitude !== 'number' ||
		typeof v.longitude !== 'number' ||
		typeof v.radius !== 'number'
	) {
		return { radius: [missing('no distance yet')], point: [missing('no point chosen')] };
	}
	const area = v as unknown as RadiusValue;
	return {
		radius: [badge(plural(area.radius, 'mile'))],
		point: [
			badge(`${area.latitude.toFixed(4)}, ${area.longitude.toFixed(4)}`, { view: 'radius' })
		]
	};
}

function polygonParts(filter: Filter): Parts {
	const v = filter.value;
	return isObject(v) && v.type === 'Polygon'
		? { region: [badge('the drawn region', { view: 'polygon' })] }
		: { region: [missing('no region drawn')] };
}

function surveyParts(filter: Filter, names: SentenceNames): Parts {
	const v = isObject(filter.value) ? (filter.value as Partial<SurveyResponseValue>) : {};
	const response = v.response
		? [badge(v.response)]
		: [missing('no response chosen')];
	return {
		question: v.questionId ? [badge(names.question ?? 'a question')] : [missing('no question chosen')],
		survey: v.surveyId ? [badge(names.survey ?? 'a survey')] : [missing('no survey chosen')],
		response
	};
}

function contactMadeParts(filter: Filter, names: SentenceNames): Parts {
	const v = isObject(filter.value) ? (filter.value as Partial<ContactMadeValue>) : null;
	if (!v || typeof v.contacted !== 'boolean') {
		return {
			outcome: [missing('no outcome yet')],
			attempt: [missing('no attempt chosen')],
			scope: [],
			range: []
		};
	}

	const attempt =
		v.position === 'latest'
			? 'the latest attempt'
			: v.position === 'nth_from_last' && v.n
				? `the ${ordinal(v.n)} attempt from the last`
				: 'any attempt';

	const scope: SentencePart[] = [];
	if (v.bucketId) {
		scope.push(clauseBreak(), text('in '), badge(names.bucket ?? 'a bucket'));
		if (v.listId) scope.push(text(' › '), badge(names.list ?? 'a list'));
	}

	const range: SentencePart[] = [];
	if (v.from && v.to) {
		range.push(
			clauseBreak(),
			text('between '),
			badge(formatDate(v.from)),
			text(' and '),
			badge(formatDate(v.to))
		);
	} else if (v.from) {
		range.push(clauseBreak(), text('since '), badge(formatDate(v.from)));
	} else if (v.to) {
		range.push(clauseBreak(), text('up to '), badge(formatDate(v.to)));
	}

	return {
		outcome: [badge(v.contacted ? 'contact was made' : 'no contact was made')],
		attempt: [badge(attempt)],
		scope,
		range
	};
}

function valueParts(filter: Filter, entry: FilterRegistryEntry, names: SentenceNames): Parts {
	switch (entry.valueType) {
		case 'text':
			return textParts(filter);
		case 'number':
			return numberParts(filter, entry);
		case 'date':
			return dateParts(filter);
		case 'boolean':
			return booleanParts(filter, entry);
		case 'select':
			return selectParts(filter, entry);
		case 'radius':
			return radiusParts(filter);
		case 'polygon':
			return polygonParts(filter);
		case 'survey_response':
			return surveyParts(filter, names);
		case 'contact_made':
			return contactMadeParts(filter, names);
	}
}

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

/** The token names a template may use for a value type, in addition to `entity` and `operation`. */
export function sentenceTokens(entry: FilterRegistryEntry): string[] {
	const probe: Filter = { item: entry.id, operation: entry.operations[0], value: null };
	return ['entity', 'operation', 'value', ...Object.keys(valueParts(probe, entry, {}))];
}

/**
 * The filter as a sentence: plain words around highlighted settings. The
 * template comes from the registry entry, so a new filter defines its own
 * wording there.
 */
export function describeFilter(
	entry: FilterRegistryEntry,
	filter: Filter,
	{ entity, names = {} }: DescribeOptions = {}
): SentencePart[] {
	const parts = valueParts(filter, entry, names);
	const operation =
		entry.operationLabels?.[filter.operation] ?? FILTER_OPERATION_LABELS[filter.operation];

	const named: Parts = {
		...parts,
		entity: [badge(entityName(entity))],
		operation: [badge(operation)],
		// All of the value's parts together, for templates that do not need them apart.
		value: parts.value ?? Object.values(parts).flat()
	};

	const out: SentencePart[] = [];
	for (const piece of entry.sentence.split(/(\{\w+\})/)) {
		const token = /^\{(\w+)\}$/.exec(piece)?.[1];
		if (token === undefined) {
			piece.split('\n').forEach((words, i) => {
				if (i > 0) out.push(clauseBreak());
				if (words) out.push(text(words));
			});
		} else {
			out.push(...(named[token] ?? []));
		}
	}
	return out;
}

/** The sentence as plain text, for labels and tests. */
export function sentenceText(parts: SentencePart[]): string {
	return parts.map((p) => p.text).join('');
}
