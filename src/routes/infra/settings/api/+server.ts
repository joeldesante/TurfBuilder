import { json, error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import { resolveInfraPermissions } from '$lib/server/permissions';

export async function PATCH({ request, locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const infraPermissions = await resolveInfraPermissions(locals.user.id);
	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	const { key, value } = await request.json();
	if (!key || value === undefined) {
		throw error(400, 'key and value are required');
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`UPDATE system_setting SET value = $1, updated_at = now() WHERE key = $2 RETURNING key`,
			[value, key]
		);
		if (result.rowCount === 0) throw error(404, 'Setting not found');
		return json({ ok: true });
	} finally {
		client.release();
	}
}
