import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getAllPlugins } from '$plugins/registry';
import { getActivePlugins } from '$lib/server/plugins';

export async function load({ locals }) {
	if (!can(locals.organization, 'plugin', 'manage')) {
		throw error(403, 'Forbidden.');
	}

	const allPlugins = getAllPlugins();
	const activePlugins = await getActivePlugins(locals.organization!.id);
	const activeBySlug = new Map(activePlugins.map((p) => [p.manifest.slug, p]));

	return {
		plugins: allPlugins.map((manifest) => {
			const installed = activeBySlug.get(manifest.slug);
			return {
				slug: manifest.slug,
				name: manifest.name,
				description: manifest.description,
				version: manifest.version,
				installed: !!installed,
				enabled: !!installed
			};
		})
	};
}
