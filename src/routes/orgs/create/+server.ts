import { json, error } from '@sveltejs/kit';
import { getAuth } from '$lib/auth';
import { POOL } from '$lib/server/database';

export async function POST({ request, locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');

	const client = await POOL.connect();
	try {
		const setting = await client.query(
			`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`
		);
		if (setting.rows[0]?.value !== 'true') {
			throw error(403, 'Organization creation is currently disabled.');
		}
	} finally {
		client.release();
	}

	const { name, slug } = await request.json();
	if (!name || !slug) throw error(400, 'Name and slug are required');

	const auth = await getAuth();
	const result = await auth.api.createOrganization({
		headers: request.headers,
		body: { name, slug }
	});

	return json({ slug: result.slug });
}
