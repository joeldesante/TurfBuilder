import { POOL } from '$lib/server/database';
import { PLUGIN_REGISTRY } from '$plugins/registry';
import type { PluginManifest } from '$plugins/types';

export interface InstalledPlugin {
	manifest: PluginManifest;
	config: Record<string, unknown>;
}

export async function getActivePlugins(orgId: string): Promise<InstalledPlugin[]> {
	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT plugin_slug, config FROM plugin_installation WHERE organization_id = $1 AND enabled = true`,
			[orgId]
		);
		return result.rows
			.map((row) => {
				const manifest = PLUGIN_REGISTRY.get(row.plugin_slug);
				if (!manifest) return null;
				return { manifest, config: row.config };
			})
			.filter(Boolean) as InstalledPlugin[];
	} finally {
		client.release();
	}
}
