import { z } from 'zod';

export const emailLogFiltersSchema = z.object({
	status: z.enum(['sent', 'skipped', 'failed']).optional().catch(undefined),
	template: z.string().trim().max(100).optional().catch(undefined),
	recipient: z.string().trim().max(320).optional().catch(undefined)
});

/** The email log's query string. Malformed values are ignored. */
export function emailLogFiltersFromUrl(url: URL) {
	return emailLogFiltersSchema.parse({
		status: url.searchParams.get('status') || undefined,
		template: url.searchParams.get('template') || undefined,
		recipient: url.searchParams.get('recipient') || undefined
	});
}
