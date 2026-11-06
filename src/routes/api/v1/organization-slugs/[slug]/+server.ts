import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { isSlugAvailable } from '$lib/server/services/organizations.service';
import { organizationSlugSchema } from '$lib/shared/schemas/organizations';
import type { OrganizationSlugAvailability } from '$lib/shared/types/organizations';

/**
 * Whether an organization URL slug is free, so the create form can flag a taken one as the user
 * types instead of after they submit.
 *
 * @auth user
 * @returns `OrganizationSlugAvailability`, `{ available: boolean }`. 400 for a malformed slug, 401 when signed out
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	requireUser(locals);

	const slug = organizationSlugSchema.safeParse(params.slug);
	if (!slug.success) throw error(400, slug.error.issues[0].message);

	const body: OrganizationSlugAvailability = { available: await isSlugAvailable(slug.data) };
	return json(body);
};
