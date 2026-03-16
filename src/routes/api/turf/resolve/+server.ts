import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { code } = await request.json();
	if (!code || typeof code !== 'string' || code.length !== 6) {
		return new Response('Invalid code format.', { status: 400 });
	}

	const client = await POOL.connect();
	try {
		const turfResult = await client.query(
			`SELECT t.id, t.organization_id, o.slug AS organization_slug
			 FROM turf t
			 JOIN auth.organization o ON o.id = t.organization_id
			 WHERE t.code = $1
			 LIMIT 1`,
			[code.toUpperCase()]
		);

		if (turfResult.rowCount === 0) {
			return new Response('Invalid code.', { status: 400 });
		}

		const { id: turfId, organization_id: turfOrgId, organization_slug: organizationSlug } = turfResult.rows[0];

		await client.query(
			`INSERT INTO turf_user (turf_id, user_id, organization_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			[turfId, user.id, turfOrgId]
		);

		return json({ turfId, organizationSlug });
	} catch (err) {
		console.error('Canvassing join error:', err);
		return json({ error: 'Server error' }, { status: 500 });
	} finally {
		client.release();
	}
}
