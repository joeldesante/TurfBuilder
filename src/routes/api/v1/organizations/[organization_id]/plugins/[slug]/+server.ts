import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { installPlugin, uninstallPlugin } from '$lib/server/services/plugin-installations.service';

/**
 * Installs the plugin, or enables it again with the config it had.
 *
 * @auth plugin.manage
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without `plugin.manage`, 404 for an unknown plugin or when the caller is not a member
 */
export const PUT: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await installPlugin(userId, parseId(params.organization_id, 'organization'), params.slug);
	return new Response(null, { status: 204 });
};

/**
 * Uninstalls the plugin. Its config is kept for a later reinstall.
 *
 * @auth plugin.manage
 * @returns 204. 400 for an invalid id, 401 when signed out, 403 without `plugin.manage`, 404 for an unknown plugin or when the caller is not a member
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	await uninstallPlugin(userId, parseId(params.organization_id, 'organization'), params.slug);
	return new Response(null, { status: 204 });
};
