import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

// PUT toggles the slug-based invite on or off.
export async function PUT({ request, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can manage invite links.' }, { status: 403 });
	}

	const { enabled }: { enabled: boolean } = await request.json();

	const client = await POOL.connect();
	try {
		await client.query(
			`INSERT INTO org_slug_invite (org_id, enabled) VALUES ($1, $2)
			 ON CONFLICT (org_id) DO UPDATE SET enabled = EXCLUDED.enabled`,
			[locals.organization.id, enabled]
		);
		return json({ ok: true, enabled });
	} finally {
		client.release();
	}
}
