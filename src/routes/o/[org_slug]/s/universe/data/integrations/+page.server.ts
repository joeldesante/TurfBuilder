import { POOL } from '$lib/server/database';
import { INTEGRATIONS, settingKey } from '$lib/server/integrations';

export async function load({ params }) {
	const orgSlug = params.org_slug;
	const keys = INTEGRATIONS.map((i) => settingKey(i.id));

	const result = await POOL.query<{ key: string; value: string }>(
		`SELECT key, value FROM system_setting WHERE key = ANY($1)`,
		[keys]
	);

	const enabledMap = Object.fromEntries(result.rows.map((r) => [r.key, r.value === 'true']));

	return {
		orgSlug,
		integrations: INTEGRATIONS.map((def) => ({
			...def,
			enabled: enabledMap[settingKey(def.id)] ?? false
		}))
	};
}
