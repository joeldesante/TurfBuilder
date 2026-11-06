import { z } from 'zod';

/** A resource that is created from a name alone, such as a survey or a script. */
export const createNamedResourceSchema = z.object({
	name: z.string().trim().min(1, 'Enter a name')
});
