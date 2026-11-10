import { z } from 'zod';

/** An organization's URL slug: lowercase letters and numbers, joined by single hyphens. */
export const organizationSlugSchema = z
	.string()
	.trim()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens');

/** What kind of organization it is, asked when it is created. */
export const ORGANIZATION_CATEGORIES = ['political', 'nonprofit', 'commercial'] as const;
export type OrganizationCategory = (typeof ORGANIZATION_CATEGORIES)[number];

export const ORGANIZATION_DESCRIPTION_MAX = 1000;
export const CAMPAIGN_REGISTRATION_MAX = 500;

/**
 * POST /api/v1/organizations. The create page validates its form with the same schema.
 *
 * `is_candidate` and `campaign_registration` only mean something for a political organization;
 * the service drops them for the other categories.
 */
export const createOrganizationSchema = z.object({
	name: z.string().trim().min(1, 'Enter a name'),
	slug: organizationSlugSchema,
	category: z.enum(ORGANIZATION_CATEGORIES, { error: 'Choose the kind of organization' }),
	description: z
		.string()
		.trim()
		.min(1, 'Tell us what your organization does')
		.max(ORGANIZATION_DESCRIPTION_MAX, `Keep it under ${ORGANIZATION_DESCRIPTION_MAX} characters`),
	is_candidate: z.boolean().default(false),
	campaign_registration: z
		.string()
		.trim()
		.max(CAMPAIGN_REGISTRATION_MAX, `Keep it under ${CAMPAIGN_REGISTRATION_MAX} characters`)
		.optional()
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
