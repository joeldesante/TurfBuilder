import { z } from 'zod';
import { filterGroupSchema } from './filters';

/**
 * What the create list page asks for. The kind of record is a plain string here because it starts
 * empty when the bucket offers more than one; the page checks it is a real kind before sending.
 */
export const createListFormSchema = z.object({
	name: z.string().trim().min(1, 'Enter a name'),
	expiresAt: z.string().min(1, 'Choose an expiration date'),
	entityType: z.string().min(1, 'Choose a kind of record'),
	filters: filterGroupSchema
});
