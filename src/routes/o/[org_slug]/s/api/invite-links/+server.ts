import { json } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';
import { nanoid } from 'nanoid';
import { can } from '$lib/auth-helpers.js';

/**
 * Returns all token-based invite links for the org plus the slug invite toggle state.
 *
 * @auth member.invite
 * @returns { links: Array<{ id, created_at, expires_at }>, slugInviteEnabled: boolean }
 */
export async function GET({ locals }) {
	if (!can(locals.organization, 'member', 'invite')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const client = await POOL.connect();
	try {
		const [linksResult, slugResult] = await Promise.all([
			client.query(
				`SELECT id, created_at, expires_at FROM org_invite_link
				 WHERE org_id = $1 ORDER BY created_at DESC`,
				[locals.organization.id]
			),
			client.query(`SELECT enabled FROM org_slug_invite WHERE org_id = $1`, [
				locals.organization.id
			])
		]);
		return json({
			links: linksResult.rows,
			slugInviteEnabled: slugResult.rows[0]?.enabled ?? false
		});
	} finally {
		client.release();
	}
}

/**
 * Creates a new token-based invite link for the organization.
 * Accessible at `/invite/{token}` once created.
 *
 * @auth member.invite
 * @body expires_at {string | null} - ISO 8601 expiration date, or null for no expiry
 * @returns { id, created_at, expires_at }
 */
export async function POST({ request, locals }) {
	if (!can(locals.organization, 'member', 'invite')) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const { expires_at }: { expires_at?: string | null } = await request.json();
	const token = nanoid(21);

	const client = await POOL.connect();
	try {
		const result = await client.query(
			`INSERT INTO org_invite_link (id, org_id, created_by, expires_at)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, created_at, expires_at`,
			[token, locals.organization.id, locals.user!.id, expires_at ?? null]
		);
		return json(result.rows[0], { status: 201 });
	} finally {
		client.release();
	}
}
