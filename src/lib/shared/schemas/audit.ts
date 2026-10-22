import { z } from 'zod';

export const auditTargetTypeSchema = z.enum([
	'user',
	'organization',
	'session',
	'setting',
	'email_template',
	'infra_role',
	'system'
]);

/** The audit log's query string. Unknown or empty parameters are dropped. */
export const auditFiltersSchema = z.object({
	actorId: z.uuid().optional(),
	action: z.string().trim().min(1).max(100).optional(),
	targetType: auditTargetTypeSchema.optional(),
	targetId: z.string().trim().min(1).max(200).optional(),
	from: z.iso.date().optional(),
	to: z.iso.date().optional()
});

/** Reads the audit filters from a URL, ignoring any that are malformed. */
export function auditFiltersFromUrl(url: URL) {
	const raw = Object.fromEntries(
		['actorId', 'action', 'targetType', 'targetId', 'from', 'to']
			.map((key) => [key, url.searchParams.get(key) || undefined])
			.filter(([, value]) => value !== undefined)
	);
	const parsed = auditFiltersSchema.safeParse(raw);
	if (parsed.success) return parsed.data;

	// Keep the parameters that are valid on their own.
	const kept: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		const one = auditFiltersSchema.safeParse({ [key]: value });
		if (one.success) Object.assign(kept, one.data);
	}
	return kept as z.infer<typeof auditFiltersSchema>;
}
