import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getPlugin } from '$plugins/registry';
import { getActivePlugins } from '$lib/server/plugins';
import { POOL } from '$lib/server/database';

async function dispatch(event: RequestEvent, method: string) {
	const { locals, params } = event;

	if (!locals.organization?.role) {
		throw error(403, 'Forbidden.');
	}

	const plugin = getPlugin(params.slug);
	if (!plugin) throw error(404, 'Plugin not found.');

	const active = await getActivePlugins(locals.organization.id);
	const installed = active.find((p) => p.manifest.slug === params.slug);
	if (!installed) throw error(404, 'Plugin is not active for this organization.');

	const handlerKey = `${method}:${params.path}`;
	const handler = plugin.apiHandlers?.[handlerKey];
	if (!handler) throw error(404, `No handler for ${handlerKey}.`);

	const ctx = {
		db: POOL,
		orgId: locals.organization.id,
		userId: locals.user!.id,
		userRole: locals.organization.role,
		config: installed.config
	};

	return handler(event, ctx);
}

export const GET = (event: RequestEvent) => dispatch(event, 'GET');
export const POST = (event: RequestEvent) => dispatch(event, 'POST');
export const PUT = (event: RequestEvent) => dispatch(event, 'PUT');
export const DELETE = (event: RequestEvent) => dispatch(event, 'DELETE');
export const PATCH = (event: RequestEvent) => dispatch(event, 'PATCH');
