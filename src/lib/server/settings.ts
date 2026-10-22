import { POOL } from '$lib/server/database';
import { SETTINGS_BY_KEY } from '$lib/shared/registries/system-settings';

export interface AppSettings {
	base_url: string;
	application_name: string;
	header_content: string;
	cat_gifs_enabled: boolean;
}

/**
 * Analytics and telemetry configuration. Kept apart from AppSettings because
 * AppSettings is sent to every browser; endpoints are for the server only.
 */
export interface ObservabilitySettings {
	analytics: { provider: 'none' | 'posthog'; posthogHost: string; posthogToken: string };
	telemetry: { tracesEndpoint: string; logsEndpoint: string };
}

const REQUIRED: (keyof AppSettings)[] = ['base_url', 'application_name'];

export async function getSettings(): Promise<AppSettings> {
	return (await getAllSettings()).app;
}

/** App and observability settings from one read of system_setting. */
export async function getAllSettings(): Promise<{ app: AppSettings; observability: ObservabilitySettings }> {
	let rows: { key: string; value: string }[];

	try {
		const result = await POOL.query<{ key: string; value: string }>(
			`SELECT key, value FROM system_setting`
		);
		rows = result.rows;
	} catch {
		throw new SettingsMissingError('(database not initialised — run /setup)');
	}

	const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));

	for (const key of REQUIRED) {
		if (!raw[key]) {
			throw new SettingsMissingError(key);
		}
	}

	// Never-saved keys fall back to the registry default.
	const value = (key: string) => (raw[key] ?? SETTINGS_BY_KEY.get(key)?.defaultValue ?? '').trim();

	return {
		app: {
			base_url: raw.base_url,
			application_name: raw.application_name,
			header_content: raw['html.header_content'] ?? '',
			cat_gifs_enabled: (raw['errors.cat_gifs'] ?? 'true') === 'true'
		},
		observability: {
			analytics: {
				provider: value('analytics.provider') === 'posthog' ? 'posthog' : 'none',
				posthogHost: value('analytics.posthog.host'),
				posthogToken: value('analytics.posthog.token')
			},
			telemetry: {
				tracesEndpoint: value('telemetry.traces_endpoint'),
				logsEndpoint: value('telemetry.logs_endpoint')
			}
		}
	};
}

export class SettingsMissingError extends Error {
	constructor(public readonly key: string) {
		super(
			`Required system setting '${key}' has not been configured. Please complete the setup wizard at /setup.`
		);
	}
}
