import { error } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { POOL } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { canInfra } from '$lib/server/permissions';
import { recordEvent } from '$lib/server/services/activity.service';
import type { InviteLink, InviteSettings } from '$lib/shared/types/members';

/**
 * Ways to join an organization without an emailed invitation: token links
 * (`/invite/{id}`, optionally expiring) and the open slug invite
 * (`/invite/{org_slug}`), which is either on or off. Staff need `member.invite`.
 *
 * org_invite_link and org_slug_invite have no row-level security, so every
 * query filters by org_id itself.
 */

const PERMISSION = 'member.invite';

/** The org's invite links, newest first, and whether its slug invite is on. */
export async function listInviteLinks(userId: string, orgId: string): Promise<InviteSettings> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	const [links, slug] = await Promise.all([
		POOL.query<InviteLink>(
			`SELECT id, created_at, expires_at FROM org_invite_link
			 WHERE org_id = $1 ORDER BY created_at DESC, id`,
			[orgId]
		),
		POOL.query<{ enabled: boolean }>(`SELECT enabled FROM org_slug_invite WHERE org_id = $1`, [
			orgId
		])
	]);

	return { links: links.rows, slugInviteEnabled: slug.rows[0]?.enabled ?? false };
}

/** Creates a token link, which never expires without an expiry. */
export async function createInviteLink(
	userId: string,
	orgId: string,
	expiresAt: string | null
): Promise<InviteLink> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	const result = await POOL.query<InviteLink>(
		`INSERT INTO org_invite_link (id, org_id, created_by, expires_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, created_at, expires_at`,
		[nanoid(21), orgId, userId, expiresAt]
	);
	return result.rows[0];
}

/**
 * Closes an invite link. Infra admins with `orgs.manage` may close any org's
 * (audited, and the link stays on record as expired); staff with
 * `member.invite` delete their own org's. 404 when the caller cannot see it.
 */
export async function revokeInviteLink(userId: string, linkId: string): Promise<void> {
	if (await canInfra(userId, 'orgs.manage')) {
		const platform = await import('$lib/server/services/platform-organizations.service');
		return platform.revokeInviteLink(userId, linkId);
	}

	const link = await POOL.query<{ org_id: string }>(
		`SELECT org_id FROM org_invite_link WHERE id = $1`,
		[linkId]
	);
	const orgId = link.rows[0]?.org_id;
	if (!orgId) throw error(404, 'Invite link not found.');

	// A non-member gets 404 here too, so links in other orgs look unknown.
	await requireOrgPermission(userId, orgId, PERMISSION).catch((e) => {
		throw e?.status === 404 ? error(404, 'Invite link not found.') : e;
	});

	await POOL.query(`DELETE FROM org_invite_link WHERE id = $1 AND org_id = $2`, [linkId, orgId]);
}

/** Turns the org's open slug invite on or off. */
export async function setSlugInvite(
	userId: string,
	orgId: string,
	enabled: boolean
): Promise<void> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	await POOL.query(
		`INSERT INTO org_slug_invite (org_id, enabled) VALUES ($1, $2)
		 ON CONFLICT (org_id) DO UPDATE SET enabled = EXCLUDED.enabled`,
		[orgId, enabled]
	);
}

// ---------------------------------------------------------------------------
// Joining through a link
// ---------------------------------------------------------------------------

export interface Invite {
	orgId: string;
	orgName: string;
	orgSlug: string;
}

/**
 * The organization a token joins: an open token link, or else an org whose
 * slug invite is on. Null when neither, or the org is deleted.
 */
async function findInvite(token: string): Promise<Invite | null> {
	const link = await POOL.query<Invite>(
		`SELECT l.org_id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug"
		 FROM org_invite_link l
		 JOIN auth.organization o ON o.id = l.org_id
		 WHERE l.id = $1 AND (l.expires_at IS NULL OR l.expires_at > now()) AND o.deleted_at IS NULL`,
		[token]
	);
	if (link.rows[0]) return link.rows[0];

	const slug = await POOL.query<Invite>(
		`SELECT o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug"
		 FROM auth.organization o
		 JOIN org_slug_invite si ON si.org_id = o.id
		 WHERE o.slug = $1 AND si.enabled = true AND o.deleted_at IS NULL`,
		[token]
	);
	return slug.rows[0] ?? null;
}

async function isMember(userId: string, orgId: string): Promise<boolean> {
	const result = await POOL.query(
		`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
		[orgId, userId]
	);
	return (result.rowCount ?? 0) > 0;
}

/**
 * What `/invite/{token}` shows: the organization, and whether the caller is
 * already in it (false when signed out). 404 when the token joins nothing.
 */
export async function getInvite(
	token: string,
	userId: string | null
): Promise<Invite & { alreadyMember: boolean }> {
	const invite = await findInvite(token);
	if (!invite) throw error(404, 'Invite link not found or has expired.');

	return { ...invite, alreadyMember: userId ? await isMember(userId, invite.orgId) : false };
}

/**
 * Adds the caller to the token's organization as a plain member (volunteer
 * access, no staff role) and returns its slug. Checks the token again, so a
 * link that expired after the page loaded is refused with 404. Joining an org
 * the caller is already in changes nothing.
 */
export async function acceptInvite(userId: string, token: string): Promise<{ orgSlug: string }> {
	const invite = await findInvite(token);
	if (!invite) throw error(404, 'Invite link not found or has expired.');

	if (!(await isMember(userId, invite.orgId))) {
		const member = await POOL.query<{ id: string }>(
			`INSERT INTO auth.member (user_id, organization_id, role) VALUES ($1, $2, 'member') RETURNING id`,
			[userId, invite.orgId]
		);
		await recordEvent('member.joined', {
			userId,
			orgId: invite.orgId,
			sourceKey: `member.joined:${member.rows[0].id}`
		});
	}

	return { orgSlug: invite.orgSlug };
}
