import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireMemberOrg, requireOrgPermission } from '$lib/server/list-access';
import { canInfra, canOrg } from '$lib/server/permissions';
import { PERMISSIONS } from '$lib/permissions-config';
import { recordEvent } from '$lib/server/services/activity.service';
import type { MemberDetail } from '$lib/shared/types/members';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';

export interface MemberRow {
	/** The user's id. */
	id: string;
	name: string;
	email: string;
	role_id: string | null;
	role_name: string | null;
	member_id: string;
	/** better-auth's member role: owner, admin, or member. */
	member_role: string;
	joined_at: Date;
	/** The last day the member used this org (YYYY-MM-DD), or null. */
	last_active_day: string | null;
}

/**
 * One page of the org's members by name, each with their highest-priority
 * non-default role. For callers that already hold an org transaction and have
 * checked `member.read`.
 */
export async function queryMembersPage(
	client: PoolClient,
	orgId: string,
	requested: number,
	q?: string
): Promise<Page<MemberRow>> {
	// An optional search by name or email, with LIKE's own wildcards escaped.
	const pattern = q?.trim()
		? `%${q
				.trim()
				.toLowerCase()
				.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
		: null;
	const search = `($2::text IS NULL OR lower(u.name) LIKE $2 OR lower(u.email) LIKE $2)`;

	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM auth.member m JOIN auth."user" u ON u.id = m.user_id
		 WHERE m.organization_id = $1 AND ${search}`,
		[orgId, pattern]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);

	// DISTINCT ON picks the lowest-weight (highest-priority) non-default role per
	// user; it needs ORDER BY u.id, so the page order is applied outside it, with
	// an id tiebreak so pages cannot repeat or skip a member.
	const rows = await client.query<MemberRow>(
		`SELECT * FROM (
			SELECT DISTINCT ON (u.id) u.id, u.name, u.email, pr.id AS role_id, pr.name AS role_name,
			       m.id AS member_id, m.role AS member_role, m.created_at AS joined_at,
			       (SELECT to_char(max(d.day), 'YYYY-MM-DD') FROM user_activity_day d
			        WHERE d.user_id = m.user_id AND d.org_key = m.organization_id::text) AS last_active_day
			  FROM auth.member m
			  JOIN auth."user" u ON u.id = m.user_id
			  LEFT JOIN user_role_membership urm ON urm.user_id = m.user_id
			  LEFT JOIN permission_role pr
			    ON pr.id = urm.role_id
			   AND pr.organization_id = m.organization_id
			   AND pr.scope = 'organization'
			   AND pr.is_default = false
			 WHERE m.organization_id = $1 AND ${search}
			 ORDER BY u.id, pr.weight ASC NULLS LAST
		) members
		ORDER BY lower(name), id
		LIMIT $3 OFFSET $4`,
		[orgId, pattern, PAGE_SIZE, pageOffset(page)]
	);

	return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
}

/**
 * One page of the org's members. Infra admins with `access` may read any org's;
 * anyone else must be a member (404 otherwise) with `member.read` (403).
 */
export async function listMembers(
	userId: string,
	orgId: string,
	requested: number,
	q?: string
): Promise<Page<MemberRow>> {
	if (!(await canInfra(userId, 'access'))) await requireOrgPermission(userId, orgId, 'member.read');

	return withOrgTransaction(orgId, (client) => queryMembersPage(client, orgId, requested, q));
}

async function requirePermission(client: PoolClient, userId: string, orgId: string, key: string) {
	if (!(await canOrg(client, userId, orgId, key))) throw error(403, 'Forbidden');
}

/**
 * A member's name and email and their permission overrides, for the member
 * detail page. Looked up by user id, since that is what the page's URL names.
 * 404 unless the caller and the user are both members, 403 without `member.read`.
 */
export async function getMemberDetail(
	userId: string,
	orgId: string,
	memberUserId: string
): Promise<MemberDetail> {
	await requireOrgPermission(userId, orgId, 'member.read');

	return withOrgTransaction(orgId, async (client) => {
		const member = await client.query<{
			member_id: string;
			id: string;
			name: string;
			email: string;
		}>(
			`SELECT m.id AS member_id, u.id, u.name, u.email
			 FROM auth.member m
			 JOIN auth.user u ON u.id = m.user_id
			 WHERE m.user_id = $1 AND m.organization_id = $2`,
			[memberUserId, orgId]
		);
		if (member.rowCount === 0) throw error(404, 'Member not found.');
		const { member_id, ...user } = member.rows[0];

		const [overrides, registered] = await Promise.all([
			client.query<{ registered_permission_id: string; value: boolean }>(
				`SELECT registered_permission_id, value FROM user_permission
				 WHERE member_id = $1 AND organization_id = $2`,
				[member_id, orgId]
			),
			client.query<{ id: string; key: string }>(
				`SELECT id, key FROM registered_permission WHERE scope = 'organization'`
			)
		]);
		const valueOf = new Map(overrides.rows.map((r) => [r.registered_permission_id, r.value]));
		const idOf = new Map(registered.rows.map((r) => [r.key, r.id]));

		const permissions = PERMISSIONS.filter((p) => idOf.has(p.key)).map((p) => {
			const id = idOf.get(p.key)!;
			return {
				id,
				key: p.key,
				label: p.label,
				group: p.group,
				description: p.description ?? null,
				value: valueOf.get(id) ?? null
			};
		});

		return { member_id, user, permissions };
	});
}

/**
 * Gives a member one organization role in place of the ones they hold, or none
 * with null. 400 for a role from elsewhere, and when it would leave the
 * organization without an administrator (a weight 0 role).
 */
export async function setMemberRole(
	userId: string,
	memberId: string,
	roleId: string | null
): Promise<void> {
	const { orgId, memberUserId } = await requireMemberOrg(userId, memberId);

	await withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'member.update');

		let newRoleIsAdmin = false;
		if (roleId !== null) {
			const role = await client.query<{ weight: number }>(
				`SELECT weight FROM permission_role
				 WHERE id = $1 AND organization_id = $2 AND scope = 'organization'`,
				[roleId, orgId]
			);
			if (role.rowCount === 0) throw error(400, "That role is not one of this organization's.");
			newRoleIsAdmin = role.rows[0].weight === 0;
		}

		if (!newRoleIsAdmin) {
			// Locked so two demotions of the last two administrators take turns.
			const admins = await client.query<{ member_id: string }>(
				`SELECT urm.member_id
				 FROM user_role_membership urm
				 JOIN permission_role pr ON pr.id = urm.role_id
				 WHERE pr.organization_id = $1 AND pr.weight = 0
				 FOR UPDATE OF urm`,
				[orgId]
			);
			const isAdmin = admins.rows.some((r) => r.member_id === memberId);
			const others = admins.rows.filter((r) => r.member_id !== memberId).length;
			if (isAdmin && others === 0) {
				throw error(
					400,
					'Cannot remove the last administrator. Assign another administrator first.'
				);
			}
		}

		await client.query(
			`DELETE FROM user_role_membership
			 WHERE member_id = $1
			   AND role_id IN (
			     SELECT id FROM permission_role WHERE organization_id = $2 AND scope = 'organization'
			   )`,
			[memberId, orgId]
		);
		if (roleId !== null) {
			await client.query(
				`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT DO NOTHING`,
				[memberUserId, memberId, roleId, userId]
			);
		}
	});
}

/**
 * Grants (true) or denies (false) one permission to a member regardless of
 * their roles, or with null drops the override so their roles decide again.
 * 400 for a permission that is not an organization permission.
 */
export async function setMemberPermission(
	userId: string,
	memberId: string,
	permissionId: string,
	value: boolean | null
): Promise<void> {
	const { orgId, memberUserId } = await requireMemberOrg(userId, memberId);

	await withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'member.update');

		if (value === null) {
			await client.query(
				`DELETE FROM user_permission
				 WHERE member_id = $1 AND registered_permission_id = $2 AND organization_id = $3`,
				[memberId, permissionId, orgId]
			);
			return;
		}

		const registered = await client.query(
			`SELECT 1 FROM registered_permission WHERE id = $1 AND scope = 'organization'`,
			[permissionId]
		);
		if (registered.rowCount === 0) throw error(400, 'Unknown permission.');

		await client.query(
			`INSERT INTO user_permission (user_id, member_id, registered_permission_id, organization_id, value, granted_by)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (member_id, registered_permission_id) WHERE member_id IS NOT NULL
			 DO UPDATE SET value = EXCLUDED.value`,
			[memberUserId, memberId, permissionId, orgId, value, userId]
		);
	});
}

/**
 * Removes someone from their organization. Infra admins with `orgs.manage`
 * may remove anyone (audited, in platform-organizations.service); otherwise the
 * caller needs `member.delete` in that organization and cannot remove
 * themselves. 409 when the member is its only owner.
 */
export async function removeMember(userId: string, memberId: string): Promise<void> {
	if (await canInfra(userId, 'orgs.manage')) {
		// Imported here: platform-organizations.service imports this module.
		const platform = await import('$lib/server/services/platform-organizations.service');
		return platform.removeMember(userId, memberId);
	}

	const { orgId, memberUserId, memberRole } = await requireMemberOrg(userId, memberId);
	if (memberUserId === userId) {
		throw error(400, 'You cannot remove yourself from the organization.');
	}

	await withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'member.delete');

		if (
			memberRole
				.split(',')
				.map((r) => r.trim())
				.includes('owner')
		) {
			// Locked so two removals of the last two owners take turns.
			const owners = await client.query(
				`SELECT id FROM auth.member
				 WHERE organization_id = $1 AND 'owner' = ANY(string_to_array(replace(role, ' ', ''), ','))
				 FOR UPDATE`,
				[orgId]
			);
			if ((owners.rowCount ?? 0) <= 1) {
				throw error(409, 'This is the only owner. Transfer ownership to someone else first.');
			}
		}

		await client.query(`DELETE FROM user_role_membership WHERE member_id = $1`, [memberId]);
		await client.query(`DELETE FROM auth.member WHERE id = $1 AND organization_id = $2`, [
			memberId,
			orgId
		]);
	});

	await recordEvent('member.left', {
		userId: memberUserId,
		orgId,
		metadata: { removedBy: userId }
	});
}
