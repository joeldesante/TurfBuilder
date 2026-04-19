import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

/**
 * Enables or disables the org slug-based open invite.
 * When enabled, anyone with the link can join at `/invite/{org_slug}`.
 *
 * @auth member.invite
 * @body enabled {boolean} required - Whether the slug-based open invite is active
 * @returns { ok: true, enabled: boolean }
 */
export async function PUT({ request, locals }) {
	if (!can(locals.organization, 'member', 'invite')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
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
