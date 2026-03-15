import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

// DELETE revokes a specific invite link.
export async function DELETE({ params, locals }) {
	if (!locals.organization?.role?.is_owner) {
		return json({ error: 'Only owners can manage invite links.' }, { status: 403 });
	}

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`DELETE FROM org_invite_link WHERE id = $1 AND org_id = $2`,
			[params.id, locals.organization.id]
		);
		if (result.rowCount === 0) {
			return json({ error: 'Invite link not found.' }, { status: 404 });
		}
		return json({ ok: true });
	} finally {
		client.release();
	}
}
