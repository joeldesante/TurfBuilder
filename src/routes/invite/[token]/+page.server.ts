import { redirect, error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database.js';

async function resolveInvite(token: string, client: Awaited<ReturnType<typeof POOL.connect>>) {
	// Try token-based link first.
	const linkResult = await client.query(
		`SELECT l.org_id, o.name AS org_name, o.slug AS org_slug
		 FROM org_invite_link l
		 JOIN auth.organization o ON o.id = l.org_id
		 WHERE l.id = $1 AND (l.expires_at IS NULL OR l.expires_at > now())`,
		[token]
	);
	if (linkResult.rows.length > 0) {
		return linkResult.rows[0] as { org_id: string; org_name: string; org_slug: string };
	}

	// Fall back to slug-based invite.
	const slugResult = await client.query(
		`SELECT o.id AS org_id, o.name AS org_name, o.slug AS org_slug
		 FROM auth.organization o
		 JOIN org_slug_invite si ON si.org_id = o.id
		 WHERE o.slug = $1 AND si.enabled = true`,
		[token]
	);
	if (slugResult.rows.length > 0) {
		return slugResult.rows[0] as { org_id: string; org_name: string; org_slug: string };
	}

	return null;
}

export async function load({ params, locals }) {
	const client = await POOL.connect();
	try {
		const invite = await resolveInvite(params.token, client);

		if (!invite) {
			throw error(404, 'Invite link not found or has expired.');
		}

		// Must be logged in to join.
		if (!locals.user) {
			throw redirect(303, `/auth/signin?redirectTo=/invite/${params.token}`);
		}

		const memberCheck = await client.query(
			`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
			[invite.org_id, locals.user.id]
		);

		return {
			orgId: invite.org_id,
			orgName: invite.org_name,
			orgSlug: invite.org_slug,
			alreadyMember: memberCheck.rows.length > 0
		};
	} finally {
		client.release();
	}
}

export const actions = {
	join: async ({ params, locals }) => {
		if (!locals.user) {
			throw redirect(303, `/auth/signin?redirectTo=/invite/${params.token}`);
		}

		const client = await POOL.connect();
		try {
			// Re-resolve at POST time to catch expiry races.
			const invite = await resolveInvite(params.token, client);
			if (!invite) {
				throw error(404, 'Invite link not found or has expired.');
			}

			// No-op if already a member.
			const existing = await client.query(
				`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
				[invite.org_id, locals.user.id]
			);
			if (existing.rows.length > 0) {
				throw redirect(303, `/o/${invite.org_slug}`);
			}

			// Add as base member — no org_user_role entry (volunteer access only).
			await client.query(
				`INSERT INTO auth.member (user_id, organization_id, role) VALUES ($1, $2, 'member')`,
				[locals.user.id, invite.org_id]
			);

			throw redirect(303, `/o/${invite.org_slug}`);
		} finally {
			client.release();
		}
	}
};
