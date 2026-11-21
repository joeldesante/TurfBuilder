import { error } from '@sveltejs/kit';
import { POOL, withTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { requireInfraPermission } from '$lib/server/permissions';
import { INTEGRATIONS, settingKey } from '$lib/server/integrations';
import type { IntegrationDef } from '$lib/server/integrations';
import { audit } from './audit.service';

/**
 * Data integrations (Google Sheets, VAN and so on). Whether each is on is a system
 * setting (`integration.{id}.enabled`), so it is the same for every
 * organization on the instance: staff can see it, and only infra admins with
 * `settings.manage` can change it.
 */

/** Every integration with whether it is on. 404 unless the caller is a member, 403 without staff access. */
export async function listIntegrations(
	userId: string,
	orgId: string
): Promise<(IntegrationDef & { enabled: boolean })[]> {
	await requireOrgPermission(userId, orgId, 'system.access');

	const result = await POOL.query<{ key: string; value: string }>(
		`SELECT key, value FROM system_setting WHERE key = ANY($1)`,
		[INTEGRATIONS.map((i) => settingKey(i.id))]
	);
	const enabled = new Map(result.rows.map((r) => [r.key, r.value === 'true']));

	return INTEGRATIONS.map((def) => ({ ...def, enabled: enabled.get(settingKey(def.id)) ?? false }));
}

/**
 * Turns an integration on or off for the whole instance, and records it in
 * the audit log. 403 without infra `settings.manage`, 404 for an unknown one.
 */
export async function setIntegrationEnabled(
	userId: string,
	integrationId: string,
	enabled: boolean
): Promise<void> {
	await requireInfraPermission(userId, 'settings.manage');
	if (!INTEGRATIONS.some((i) => i.id === integrationId)) throw error(404, 'Unknown integration');

	const key = settingKey(integrationId);
	await withTransaction(async (client) => {
		await client.query(
			`INSERT INTO system_setting (key, value, description)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			[key, String(enabled), `Integration enabled flag: ${integrationId}`]
		);
		await audit(
			userId,
			'settings.update',
			{ type: 'setting' },
			{ changes: [{ key, to: String(enabled) }] },
			client
		);
	});
}
