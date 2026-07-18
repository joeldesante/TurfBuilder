import { POOL } from '$lib/server/database';

export interface AmazonSESConfig {
	region: string
}

export interface Settings {
	applicationName: string	// Stylize
	baseURLs: Array<string>
	trustedOrigins: Array<string>
	services: {
		overture: {
			enabled: boolean
			natsHost: string
			natsPort: number
			apiPort: number
		},
		email: {
			transport: 'ses' | 'direct'
			domain: string
			other?: AmazonSESConfig
		}
	},
	technical: {
		head: string
		catGifs: boolean	// Stylize
		tenateMode: 'single' | 'multi',
		telemetry: boolean
	},
	organizations: {
		allowCreation: boolean
	}
}

export async function getSettings(): Promise<Settings> {
	let settings = null;
	const result = await POOL.query<{ value: string }>(
		`SELECT value FROM system_setting WHERE key = "settings";`
	);
	if(result.rowCount == 0) throw new Error("Could not find any settings.");
	settings = JSON.parse(result.rows[0].value);

	return settings as Settings;
}

export async function commitSettings(settings: Settings): Promise<Settings> {
	// Create or update settings record...
	return settings;
}