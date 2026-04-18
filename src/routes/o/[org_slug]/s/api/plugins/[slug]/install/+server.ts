import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getPlugin } from '$plugins/registry';
import { POOL } from '$lib/server/database';

/**
 * Installs and enables a plugin for the organization. Creates or re-enables
 * the plugin_installation record. The plugin appears in the staff nav immediately.
 *
 * @auth staff
 * @permission plugin:manage
 * @returns { ok: true }
 */
export async function POST({ locals, params }) {
	if (!can(locals.organization, 'plugin', 'manage')) {
		throw error(403, 'Forbidden.');
	}

	const plugin = getPlugin(params.slug);
	if (!plugin) throw error(404, 'Plugin not found.');

	const client = await POOL.connect();
	try {
		await client.query(
			`INSERT INTO plugin_installation (organization_id, plugin_slug, enabled, installed_by)
			 VALUES ($1, $2, true, $3)
			 ON CONFLICT (organization_id, plugin_slug)
			 DO UPDATE SET enabled = true, updated_at = now()`,
			[locals.organization!.id, params.slug, locals.user!.id]
		);
		return json({ ok: true });
	} finally {
		client.release();
	}
}
