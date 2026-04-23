import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		await POOL.query('SELECT 1');
		return json({ ok: true });
	} catch (e) {
		return json({ ok: false, error: String(e) }, { status: 200 });
	}
};
