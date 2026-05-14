import { json, error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { mail_domain, mail_transport, ses_region } = await request.json();

	const settings: [string, string][] = [
		['mail.domain', mail_domain ?? ''],
		['mail.transport', mail_transport ?? 'direct'],
		['mail.ses.region', ses_region ?? '']
	];

	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		for (const [key, value] of settings) {
			await client.query(
				`INSERT INTO system_setting (key, value) VALUES ($1, $2)
				 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
				[key, value]
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw error(500, `Failed to save email settings: ${String(e)}`);
	} finally {
		client.release();
	}

	return json({ ok: true });
};
