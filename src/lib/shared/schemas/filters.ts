import { z } from 'zod';
import type { BucketFilters, Filter, FilterGroup } from '../types/filters';
import type { FilterRegistryEntry, FilterValueType } from '../types/filter-registry';
import { getFilter } from '../utils/filter-registry';
import { isAnsweredOperation } from '../utils/filters';

/**
 * Validation for the filter editor's output, shared by the browser (to mark
 * incomplete rows) and the server (to refuse bad documents). Nothing here may
 * import from `$lib/server` or `$app`.
 *
 * A filter is only valid when it is complete: the editor lets a row be added
 * with an empty value, so "City is (blank)" parses as a filter but must not
 * parse as a valid one.
 */

const position = z.tuple([z.number(), z.number()]).rest(z.number());

const linearRing = z
	.array(position)
	.min(4)
	.refine(
		(ring) => {
			const first = ring[0];
			const last = ring[ring.length - 1];
			return first[0] === last[0] && first[1] === last[1];
		},
		{ message: 'A polygon ring must end where it starts' }
	);

const radiusValue = z.object({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	radius: z.number().positive()
});

const polygonValue = z.object({
	type: z.literal('Polygon'),
	coordinates: z.array(linearRing).min(1)
});

const contactMadeValue = z
	.object({
		contacted: z.boolean(),
		position: z.enum(['any', 'latest', 'nth_from_last']),
		n: z.number().int().min(2).max(50).nullable(),
		bucketId: z.uuid().nullable(),
		listId: z.uuid().nullable(),
		from: z.iso.date().nullable(),
		to: z.iso.date().nullable()
	})
	.superRefine((value, ctx) => {
		if (value.position === 'nth_from_last' && value.n === null) {
			ctx.addIssue({ code: 'custom', path: ['n'], message: 'Say which attempt from the last' });
		}
		if (value.position !== 'nth_from_last' && value.n !== null) {
			ctx.addIssue({ code: 'custom', path: ['n'], message: 'A position is only given for "from the last"' });
		}
		if (value.from && value.to && value.from > value.to) {
			ctx.addIssue({ code: 'custom', path: ['to'], message: 'The end date is before the start date' });
		}
	});

const surveyResponseValue = z.object({
	bucketId: z.uuid(),
	surveyId: z.uuid(),
	questionId: z.uuid(),
	response: z.string().min(1)
});

/** Whether a question was answered at all takes no response to compare with. */
const surveyQuestionValue = surveyResponseValue.extend({ response: z.string() });

/** The shape of the value for each kind of filter, ignoring which options a `select` allows. */
const VALUE_SCHEMAS: Record<Exclude<FilterValueType, 'select'>, z.ZodType> = {
	text: z.string().min(1),
	number: z.number(),
	date: z.iso.date(),
	boolean: z.boolean(),
	radius: radiusValue,
	polygon: polygonValue,
	survey_response: surveyResponseValue,
	contact_made: contactMadeValue
};

export function valueSchemaFor(entry: FilterRegistryEntry): z.ZodType {
	if (entry.valueType !== 'select') return VALUE_SCHEMAS[entry.valueType];
	const options = (entry.options ?? []).map((o) => o.value);
	return z.string().refine((v) => options.includes(v), { message: 'Not one of the allowed options' });
}

export const filterSchema: z.ZodType<Filter> = z
	.object({
		item: z.string().min(1),
		operation: z.string().min(1),
		value: z.unknown(),
		caseSensitive: z.boolean().optional()
	})
	.superRefine((filter, ctx) => {
		const entry = getFilter(filter.item);
		if (!entry) {
			ctx.addIssue({ code: 'custom', path: ['item'], message: `Unknown filter "${filter.item}"` });
			return;
		}

		if (!(entry.operations as string[]).includes(filter.operation)) {
			ctx.addIssue({
				code: 'custom',
				path: ['operation'],
				message: `"${filter.operation}" is not allowed for ${entry.name}`
			});
		}

		const value = (
			entry.valueType === 'survey_response' && isAnsweredOperation(filter.operation)
				? surveyQuestionValue
				: valueSchemaFor(entry)
		).safeParse(filter.value);
		if (!value.success) {
			// A rule written for the filter (such as a date range that ends before it starts) says what is wrong; a plain type mismatch does not.
			const issue = value.error.issues[0];
			ctx.addIssue({
				code: 'custom',
				path: ['value', ...issue.path],
				message: issue.code === 'custom' ? issue.message : `${entry.name} needs a valid value`
			});
		}

		if (filter.caseSensitive !== undefined && entry.valueType !== 'text') {
			ctx.addIssue({
				code: 'custom',
				path: ['caseSensitive'],
				message: 'Only text filters can be case sensitive'
			});
		}
	}) as unknown as z.ZodType<Filter>;

export const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
	z.object({
		operator: z.enum(['AND', 'OR']),
		not: z.boolean().optional(),
		filters: z.array(z.union([filterGroupSchema, filterSchema]))
	})
);

/** A bucket's stored filters. */
export const bucketFiltersSchema: z.ZodType<BucketFilters> = z.object({
	v: z.literal(2),
	people: filterGroupSchema.nullable(),
	locations: filterGroupSchema.nullable()
});
