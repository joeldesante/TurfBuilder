import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Permanently revokes an invite link. The link can no longer be used to join the org.
 *
 * @auth member.invite
 * @returns { ok: true }
 */
export async function DELETE({ params, locals }) {
	if (!can(locals.organization, 'member', 'invite')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
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
