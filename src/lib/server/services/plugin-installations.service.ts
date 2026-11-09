import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { getActivePlugins } from '$lib/server/plugins';
import { logger, zodIssues } from '$lib/server/logger';
import { requireRequestOrganization } from '$lib/server/services/request-organization.service';
import { getPlugin } from '$plugins/registry';
import type { PluginContext, PluginManifest } from '$plugins/types';

/**
 * Plugins per organization: installing, uninstalling and configuring them
 * (`plugin.manage`), and running their API handlers for staff.
 *
 * Uninstalling only disables the installation; its config stays for a later
 * reinstall.
 */

const PERMISSION = 'plugin.manage';

function requirePlugin(slug: string): PluginManifest {
	const plugin = getPlugin(slug);
	if (!plugin) throw error(404, 'Plugin not found.');
	return plugin;
}

/** Installs a plugin, or enables it again with its old config. 404 for a plugin not in the registry. */
export async function installPlugin(userId: string, orgId: string, slug: string): Promise<void> {
	requirePlugin(slug);
	await requireOrgPermission(userId, orgId, PERMISSION);

	await withOrgTransaction(orgId, (client) =>
		client.query(
			`INSERT INTO plugin_installation (organization_id, plugin_slug, enabled, installed_by)
			 VALUES ($1, $2, true, $3)
			 ON CONFLICT (organization_id, plugin_slug)
			 DO UPDATE SET enabled = true, updated_at = now()`,
			[orgId, slug, userId]
		)
	);
}

/** Disables a plugin, keeping its config. Nothing happens when it was never installed. */
export async function uninstallPlugin(userId: string, orgId: string, slug: string): Promise<void> {
	requirePlugin(slug);
	await requireOrgPermission(userId, orgId, PERMISSION);

	await withOrgTransaction(orgId, (client) =>
		client.query(
			`UPDATE plugin_installation SET enabled = false, updated_at = now()
			 WHERE organization_id = $1 AND plugin_slug = $2`,
			[orgId, slug]
		)
	);
}

/**
 * Replaces an installed plugin's config. 400 when it fails the plugin's
 * `configSchema`, 404 when the plugin was never installed in the org.
 */
export async function replacePluginConfig(
	userId: string,
	orgId: string,
	slug: string,
	config: unknown
): Promise<void> {
	const plugin = requirePlugin(slug);
	await requireOrgPermission(userId, orgId, PERMISSION);

	let checked = config;
	if (plugin.configSchema) {
		const result = plugin.configSchema.safeParse(config);
		if (!result.success) {
			logger.warn(
				{ issues: zodIssues(result.error), organizationId: orgId, plugin: slug },
				'Plugin config failed validation; nothing was saved'
			);
			throw error(400, 'Invalid configuration.');
		}
		checked = result.data;
	}

	const result = await withOrgTransaction(orgId, (client) =>
		client.query(
			`UPDATE plugin_installation SET config = $3, updated_at = now()
			 WHERE organization_id = $1 AND plugin_slug = $2`,
			[orgId, slug, JSON.stringify(checked)]
		)
	);
	if (result.rowCount === 0) throw error(404, 'This plugin is not installed.');
}

/**
 * Runs a plugin's `METHOD:path` API handler for a staff member of the org.
 * 403 without a staff role, 404 when the plugin is not active in the org or
 * has no such handler.
 */
export async function runPluginApi(
	userId: string,
	orgId: string,
	slug: string,
	method: string,
	path: string,
	event: RequestEvent
): Promise<Response> {
	const plugin = requirePlugin(slug);

	const organization = await requireRequestOrganization(userId, orgId);
	if (!organization.role) throw error(403, 'Forbidden');

	const installed = (await getActivePlugins(orgId)).find((p) => p.manifest.slug === slug);
	if (!installed) throw error(404, 'Plugin is not active for this organization.');

	const handlerKey = `${method}:${path}`;
	const handler = plugin.apiHandlers?.[handlerKey];
	if (!handler) throw error(404, `No handler for ${handlerKey}.`);

	const ctx: PluginContext = {
		orgId,
		userId,
		userRole: organization.role,
		config: installed.config
	};
	return handler(event, ctx);
}
