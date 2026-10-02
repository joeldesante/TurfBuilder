import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { createOrganization } from '$lib/server/services/organizations.service';

const postSchema = z.object({
	name: z.string().trim().min(1),
	slug: z
		.string()
		.trim()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens')
});

/**
 * Creates a new organization with the caller as its owner.
 *
 * Goes through better-auth so the default roles are created too. Fails with 403 when
 * creation is disabled in system settings and 409 when the slug is taken.
 *
 * @auth user
 * @body name {string} - Display name of the organization
 * @body slug {string} - URL slug, unique across organizations
 * @returns 201 `{ id, name, slug, created_at }`. 400 for an invalid body, 401 when signed out, 403 when creation is disabled, 409 for a taken slug
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = requireUser(locals);

	const body = postSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await createOrganization(userId, body.data, request.headers), { status: 201 });
};
