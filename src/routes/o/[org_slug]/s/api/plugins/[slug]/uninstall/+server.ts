import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers';
import { getPlugin } from '$plugins/registry';
import { POOL } from '$lib/server/database';

export async function POST({ locals, params }) {
	if (!can(locals.organization, 'plugin', 'manage')) {
		throw error(403, 'Forbidden.');
	}

	const plugin = getPlugin(params.slug);
	if (!plugin) throw error(404, 'Plugin not found.');

	const client = await POOL.connect();
	try {
		await client.query(
			`UPDATE plugin_installation SET enabled = false, updated_at = now()
			 WHERE organization_id = $1 AND plugin_slug = $2`,
			[locals.organization!.id, params.slug]
		);
		return json({ ok: true });
	} finally {
		client.release();
	}
}
