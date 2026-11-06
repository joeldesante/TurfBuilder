import { z } from 'zod';
import { slugFromName } from '$lib/shared/utils/slug';
import { bucketFiltersSchema } from './filters';

/** What the create bucket page asks for. The slug is derived from the name, not typed. */
export const createBucketFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Enter a name')
		.refine((name) => slugFromName(name) !== '', 'Use at least one letter or number'),
	filters: bucketFiltersSchema.refine(
		(filters) => filters.people !== null || filters.locations !== null,
		'Include at least one kind of record.'
	)
});
