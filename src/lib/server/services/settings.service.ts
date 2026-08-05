import { POOL } from '$lib/server/database';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

export const AmazonSESConfigSchema = z.object({
	region: z.string()
});

export const SettingsSchema = z.object({
	setupComplete: z.boolean(),
	applicationName: z.string().min(1, 'Application name is required'), // Stylize
	baseURLs: z.array(z.string()),
	trustedOrigins: z.array(z.string()),
	services: z.object({
		overture: z.object({
			enabled: z.boolean(),
			natsHost: z.string(),
			natsPort: z.number(),
			apiPort: z.number()
		}),
		email: z.object({
			transport: z.enum(['ses', 'direct']),
			domain: z.string(),
			other: AmazonSESConfigSchema.optional()
		})
	}),
	technical: z.object({
		head: z.string(),
		catGifs: z.boolean(), // Stylize
		tenateMode: z.enum(['single', 'multi']),
		telemetry: z.boolean()
	}),
	organizations: z.object({
		allowCreation: z.boolean()
	})
});

export type AmazonSESConfig = z.infer<typeof AmazonSESConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

export async function getSettings(): Promise<Settings> {
	const result = await POOL.query<{ value: string }>(
		`SELECT value FROM system_setting WHERE key = 'settings';`
	);

	if(result.rowCount == 0) throw new Error("could not find any settings.");
	let settings = JSON.parse(result.rows[0].value);

	return settings as Settings;
}

export async function commitSettings(settings: Settings): Promise<Settings> {
	try {
		await POOL.query(
			`INSERT INTO system_setting (key, value)
			VALUES ('settings', $1)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			[JSON.stringify(settings)]
		);
	} catch (e) {
		logger.error({ err: e }, 'Error committing settings');
	}

	return settings;
}

