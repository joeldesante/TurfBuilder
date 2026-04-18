import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getPlugin } from '$plugins/registry';
import { POOL } from '$lib/server/database';

/**
 * Updates the stored configuration for an installed plugin.
 * If the plugin defines a `configSchema` (Zod), the body is validated before saving.
 *
 * @auth staff
 * @permission plugin:manage
 * @body (plugin-defined) - JSON config object validated against the plugin's configSchema if present
 * @returns { ok: true }
 */
export async function PUT({ locals, params, request }) {
	if (!can(locals.organization, 'plugin', 'manage')) {
		throw error(403, 'Forbidden.');
	}

	const plugin = getPlugin(params.slug);
	if (!plugin) throw error(404, 'Plugin not found.');

	const body = await request.json();

	// Validate against plugin's configSchema if provided
	if (plugin.configSchema) {
		const result = plugin.configSchema.safeParse(body);
		if (!result.success) {
			console.error('Plugin config validation failed:', result.error);
			throw error(400, 'Invalid configuration.');
		}
	}

	const client = await POOL.connect();
	try {
		await client.query(
			`UPDATE plugin_installation SET config = $3, updated_at = now()
			 WHERE organization_id = $1 AND plugin_slug = $2`,
			[locals.organization!.id, params.slug, JSON.stringify(body)]
		);
		return json({ ok: true });
	} finally {
		client.release();
	}
}
