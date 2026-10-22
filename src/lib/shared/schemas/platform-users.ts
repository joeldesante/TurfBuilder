import { z } from 'zod';

export const userFiltersSchema = z.object({
	q: z.string().trim().max(200).optional().catch(undefined),
	status: z
		.enum(['all', 'unverified', 'suspended', 'two_factor', 'infra_admin', 'no_orgs', 'never_active'])
		.optional()
		.catch(undefined),
	sort: z.enum(['newest', 'oldest', 'recently_active', 'name']).optional().catch(undefined)
});

/** The users list's query string. Malformed values fall back to the defaults. */
export function userFiltersFromUrl(url: URL) {
	return userFiltersSchema.parse({
		q: url.searchParams.get('q') || undefined,
		status: url.searchParams.get('status') || undefined,
		sort: url.searchParams.get('sort') || undefined
	});
}

const username = z
	.string()
	.trim()
	.min(3, 'Usernames are at least 3 characters.')
	.max(30, 'Usernames are at most 30 characters.')
	.regex(/^[a-zA-Z0-9_.]+$/, 'Usernames use letters, numbers, dots, and underscores.');

/** PATCH /api/v1/users/[user_id]: any of these, at least one. */
export const updateUserSchema = z
	.object({
		name: z.string().trim().min(1, 'Enter a name.').max(100),
		email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
		username,
		emailVerified: z.boolean()
	})
	.partial()
	.refine((value) => Object.keys(value).length > 0, 'Nothing to change.');

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** PUT /api/v1/users/[user_id]/suspension. */
export const suspendUserSchema = z.object({
	reason: z.string().trim().min(1, 'Give a reason; the user sees it when they try to sign in.').max(500),
	/** ISO date-time the suspension ends; null or absent for no end. */
	expiresAt: z.iso
		.datetime({ offset: true, message: 'Enter a valid end date.' })
		.nullable()
		.optional()
		.refine((value) => !value || new Date(value) > new Date(), 'The end date must be in the future.')
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

/** DELETE /api/v1/users/[user_id]: the email typed back as confirmation. */
export const deleteUserSchema = z.object({
	confirmEmail: z.string().trim().toLowerCase()
});
