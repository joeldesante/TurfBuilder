import { z } from 'zod';

/** An organization's URL slug: lowercase letters and numbers, joined by single hyphens. */
export const organizationSlugSchema = z
	.string()
	.trim()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens');

/** POST /api/v1/organizations. The create page validates its form with the same schema. */
export const createOrganizationSchema = z.object({
	name: z.string().trim().min(1, 'Enter a name'),
	slug: organizationSlugSchema
});
