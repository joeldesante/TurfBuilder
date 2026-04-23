import { json, error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import { resetAuth } from '$lib/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { base_url, application_name } = await request.json();

	if (!base_url || !application_name) {
		throw error(400, 'base_url and application_name are required');
	}

	try {
		new URL(base_url);
	} catch {
		throw error(400, 'base_url must be a valid URL');
	}

	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		await client.query(
			`INSERT INTO system_setting (key, value) VALUES ('base_url', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
			[base_url]
		);
		await client.query(
			`INSERT INTO system_setting (key, value) VALUES ('application_name', $1)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
			[application_name]
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw error(500, `Failed to save settings: ${String(e)}`);
	} finally {
		client.release();
	}

	// Re-init auth so it picks up the new base_url.
	resetAuth();

	return json({ ok: true });
};
