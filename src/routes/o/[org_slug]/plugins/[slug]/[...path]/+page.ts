import { error } from '@sveltejs/kit';
import { getPlugin } from '$plugins/registry';

export async function load({ params, data }) {
	const plugin = getPlugin(params.slug);
	if (!plugin) throw error(404, 'Plugin not found.');

	const path = params.path || 'index';
	const PageComponent = plugin.volunteerPages?.[path];
	if (!PageComponent) throw error(404, `Plugin page "${path}" not found.`);

	return { PageComponent, ...data };
}
