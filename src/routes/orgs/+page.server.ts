import { POOL } from '$lib/server/database.js';
import { getAuth } from '$lib/auth';

export async function load({ locals }) {
	const client = await POOL.connect();
	try {
		const settingResult = await client.query(`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`)
		const allowCreation = settingResult.rows[0]?.value === 'true';
		return { allowCreation };
	} finally {
		client.release();
	}
}
