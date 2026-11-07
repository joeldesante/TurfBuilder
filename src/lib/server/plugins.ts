import { withOrgTransaction } from '$lib/server/database';
import { PLUGIN_REGISTRY } from '$plugins/registry';
import type { PluginManifest } from '$plugins/types';

export interface InstalledPlugin {
	manifest: PluginManifest;
	config: Record<string, unknown>;
}

/** The org's enabled plugins that are still in the registry, with their stored config. */
export async function getActivePlugins(orgId: string): Promise<InstalledPlugin[]> {
	// plugin_installation has forced row-level security, so it is read inside
	// the org's transaction; outside one it shows no rows.
	const rows = await withOrgTransaction(orgId, async (client) => {
		const result = await client.query<{ plugin_slug: string; config: Record<string, unknown> }>(
			`SELECT plugin_slug, config FROM plugin_installation WHERE organization_id = $1 AND enabled = true`,
			[orgId]
		);
		return result.rows;
	});

	return rows.flatMap((row) => {
		const manifest = PLUGIN_REGISTRY.get(row.plugin_slug);
		return manifest ? [{ manifest, config: row.config }] : [];
	});
}
