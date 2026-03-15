import { error } from '@sveltejs/kit';
import { getPlugin } from '$plugins/registry';
import { getActivePlugins } from '$lib/server/plugins';

export async function load({ locals, params }) {
	const plugin = getPlugin(params.slug);
	if (!plugin) throw error(404, 'Plugin not found.');

	const active = await getActivePlugins(locals.organization!.id);
	const installed = active.find((p) => p.manifest.slug === params.slug);
	if (!installed) throw error(404, 'Plugin is not active for this organization.');

	return { pluginName: plugin.name };
}
