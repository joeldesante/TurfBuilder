import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async () => {
	try {
		await POOL.query('SELECT 1');
		return json({ ok: true });
	} catch (e) {
		logger.warn({ err: e }, 'Setup database check failed');
		return json({ ok: false, error: String(e) }, { status: 200 });
	}
};
