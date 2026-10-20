import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { resetAuth } from '$lib/auth';
import { POOL } from '$lib/server/database';
import { requireInfraPermission } from '$lib/server/permissions';
import { storageCredentialsPresent } from '$lib/server/storage';
import { audit } from './audit.service';
import {
	externalLinkSchema,
	SETTINGS_BY_KEY,
	SYSTEM_SETTINGS
} from '$lib/shared/registries/system-settings';
import type { SystemSettingValue } from '$lib/shared/types/system-settings';
import type { ExternalLink } from '$lib/shared/types/infra';

/** Every registered setting's stored value, or its default when it has never been saved. */
async function readValues(keys: string[]): Promise<Map<string, { value: string; updatedAt: Date | null }>> {
	const result = await POOL.query<{ key: string; value: string; updated_at: Date }>(
		`SELECT key, value, updated_at FROM system_setting WHERE key = ANY($1)`,
		[keys]
	);
	const stored = new Map(result.rows.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
	return new Map(
		keys.map((key) => [key, stored.get(key) ?? { value: SETTINGS_BY_KEY.get(key)?.defaultValue ?? '', updatedAt: null }])
	);
}

/** The settings page's values. 403 without `settings.manage`. */
export async function getSystemSettings(userId: string): Promise<SystemSettingValue[]> {
	await requireInfraPermission(userId, 'settings.manage');
	const values = await readValues(SYSTEM_SETTINGS.map((s) => s.key));
	return SYSTEM_SETTINGS.map((s) => {
		const v = values.get(s.key)!;
		return { key: s.key, value: v.value, updatedAt: v.updatedAt?.toISOString() ?? null };
	});
}

/**
 * Saves already validated settings (see parseSettingsUpdate) and records the
 * change. Keys missing from the table are created with the registry's
 * description. Changing base_url rebuilds the auth instance on this process;
 * other pods pick it up when they restart.
 */
export async function updateSystemSettings(
	userId: string,
	values: Record<string, string>
): Promise<{ saved: string[]; restartRequired: boolean }> {
	await requireInfraPermission(userId, 'settings.manage');

	const keys = Object.keys(values);
	for (const key of keys) {
		if (!SETTINGS_BY_KEY.has(key)) throw error(400, `Unknown setting: ${key}`);
	}

	const before = await readValues(keys);
	const changed = keys.filter((key) => before.get(key)?.value !== values[key]);
	if (changed.length === 0) return { saved: [], restartRequired: false };

	await POOL.query(
		`INSERT INTO system_setting (key, value, description)
		 SELECT k, v, d FROM unnest($1::text[], $2::text[], $3::text[]) AS t(k, v, d)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
		[changed, changed.map((key) => values[key]), changed.map((key) => SETTINGS_BY_KEY.get(key)!.help)]
	);

	// Raw HTML is not copied into the log; it can be long and holds script tags.
	await audit(userId, 'settings.update', { type: 'setting' }, {
		changes: changed.map((key) => ({
			key,
			from: key === 'html.header_content' ? '(html)' : before.get(key)?.value ?? null,
			to: key === 'html.header_content' ? '(html)' : values[key]
		}))
	});

	if (changed.includes('base_url')) resetAuth();

	return {
		saved: changed,
		restartRequired: changed.some((key) => SETTINGS_BY_KEY.get(key)?.requiresRestart)
	};
}

/**
 * The external tool links for the infra sidebar and quick menu, in order:
 * analytics, tracing, then the custom ones. Empty or malformed values are
 * skipped. No access check: callers only show these to infra admins.
 */
export async function getExternalLinks(): Promise<ExternalLink[]> {
	const values = await readValues(['links.analytics_url', 'links.tracing_url', 'links.custom']);
	const links: ExternalLink[] = [];

	const analytics = values.get('links.analytics_url')?.value.trim();
	if (analytics) links.push({ label: 'Analytics', url: analytics });
	const tracing = values.get('links.tracing_url')?.value.trim();
	if (tracing) links.push({ label: 'Tracing', url: tracing });

	try {
		const custom = z.array(externalLinkSchema).safeParse(JSON.parse(values.get('links.custom')?.value || '[]'));
		if (custom.success) links.push(...custom.data);
	} catch {
		// A malformed list is shown as no links rather than breaking every page.
	}
	return links;
}

/**
 * Which credentials the environment provides, so the settings page can say
 * what is missing. Values are never returned. 403 without `settings.manage`.
 */
export async function getCredentialStatus(userId: string): Promise<{
	aws: boolean;
	storageAccessKey: boolean;
	storageSecretKey: boolean;
}> {
	await requireInfraPermission(userId, 'settings.manage');
	const storage = storageCredentialsPresent();
	return {
		aws: Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
		storageAccessKey: storage.accessKeyId,
		storageSecretKey: storage.secretAccessKey
	};
}
