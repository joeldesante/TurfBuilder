import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { replacePluginConfig } from '$lib/server/services/plugin-installations.service';

/**
 * Replaces an installed plugin's config.
 *
 * @auth plugin.manage
 * @body The config object, checked against the plugin's `configSchema` when it has one
 * @returns 204. 400 for an invalid id or config, 401 when signed out, 403 without `plugin.manage`, 404 for an unknown or uninstalled plugin, or when the caller is not a member
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	const body = await request.json().catch(() => undefined);
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		throw error(400, 'The config must be a JSON object.');
	}

	await replacePluginConfig(userId, orgId, params.slug, body);
	return new Response(null, { status: 204 });
};
