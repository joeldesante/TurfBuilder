import { POOL } from '$lib/server/database';
import { SETTINGS_BY_KEY } from '$lib/shared/registries/system-settings';
import type { ErrorCode } from '$lib/shared/registries/error-codes';

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
	} catch (e) {
		// 42P01 is a missing table: the database answers but has not been migrated.
		const code = (e as { code?: string }).code === '42P01' ? 'APP_NOT_MIGRATED' : 'DATABASE_UNREACHABLE';
		throw new NotReadyError(code, e);
	}

	const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));

	for (const key of REQUIRED) {
		if (!raw[key]) {
			throw new NotReadyError('APP_NOT_SET_UP', `Required system setting '${key}' has not been configured`);
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

/** The app cannot serve yet. The code picks the page shown (see error-codes.ts); the cause is kept for the log. */
export class NotReadyError extends Error {
	constructor(
		public readonly code: ErrorCode,
		cause?: unknown
	) {
		super(`The app is not ready: ${code}`, { cause });
	}
}
