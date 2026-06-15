import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';

export async function load({ parent }) {
	const { infraPermissions } = await parent();

	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`SELECT key, subject, updated_at FROM email_template ORDER BY key`
		);
		return { templates: result.rows };
	} finally {
		client.release();
	}
}
