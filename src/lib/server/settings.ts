import { POOL } from '$lib/server/database';

export interface AppSettings {
	base_url: string;
	application_name: string;
	header_content: string;
	cat_gifs_enabled: boolean;
}

const REQUIRED: (keyof AppSettings)[] = ['base_url', 'application_name'];

export async function getSettings(): Promise<AppSettings> {
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

	return {
		base_url: raw.base_url,
		application_name: raw.application_name,
		header_content: raw['html.header_content'] ?? '',
		cat_gifs_enabled: (raw['errors.cat_gifs'] ?? 'true') === 'true'
	};
}

export class SettingsMissingError extends Error {
	constructor(public readonly key: string) {
		super(
			`Required system setting '${key}' has not been configured. Please complete the setup wizard at /setup.`
		);
	}
}
