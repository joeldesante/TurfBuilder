import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { POOL } from '$lib/server/database';
import { resetAuth } from '$lib/auth';
import type { RequestHandler } from './$types';

const SETTING_KEY = z.enum([
	'base_url',
	'base_url.trusted_origins',
	'application_name',
	'logo_src',
	'errors.cat_gifs',
	'map.style_url',
	'tenant.mode',
	'org.allow_public_creation',
	'org.complexity',
	'overture.enabled',
	'overture.host_mode',
	'overture.nats_url',
	'overture.access_key'
]);

const bodySchema = z.object({
	settings: z
		.partialRecord(SETTING_KEY, z.string())
		.refine((s) => Object.keys(s).length > 0, 'At least one setting is required')
});

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
	}

	const settings = parsed.data.settings;

	if (settings.base_url !== undefined) {
		try {
			new URL(settings.base_url);
		} catch {
			throw error(400, 'base_url must be a valid URL');
		}
	}

	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		for (const [key, value] of Object.entries(settings)) {
			await client.query(
				`INSERT INTO system_setting (key, value) VALUES ($1, $2)
				 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
				[key, value]
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw error(500, `Failed to save settings: ${String(e)}`);
	} finally {
		client.release();
	}

	// base_url is read at auth instance startup — re-init so it takes effect.
	if (settings.base_url !== undefined) {
		resetAuth();
	}

	return json({ ok: true });
};
