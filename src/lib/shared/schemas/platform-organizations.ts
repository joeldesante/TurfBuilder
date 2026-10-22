import { z } from 'zod';

export const orgFiltersSchema = z.object({
	q: z.string().trim().max(200).optional().catch(undefined),
	status: z.enum(['all', 'active', 'inactive', 'suspended', 'deleted']).optional().catch(undefined),
	sort: z.enum(['newest', 'oldest', 'members', 'recently_active', 'name']).optional().catch(undefined)
});

/** The organizations list's query string. Malformed values fall back to the defaults. */
export function orgFiltersFromUrl(url: URL) {
	return orgFiltersSchema.parse({
		q: url.searchParams.get('q') || undefined,
		status: url.searchParams.get('status') || undefined,
		sort: url.searchParams.get('sort') || undefined
	});
}

/** PUT /api/v1/organizations/[organization_id]/suspension. */
export const suspendOrgSchema = z.object({
	reason: z.string().trim().min(1, 'Give a reason; members see it.').max(500)
});

/** PUT /api/v1/organizations/[organization_id]/ownership. */
export const transferOwnershipSchema = z.object({
	memberId: z.uuid('Choose a member.')
});

/** DELETE /api/v1/organizations/[organization_id]: the slug typed back as confirmation. */
export const deleteOrgSchema = z.object({
	confirmSlug: z.string().trim()
});
