import { error } from '@sveltejs/kit';
import { POOL, withOrgTransaction, withTransaction } from '$lib/server/database';
import { requireInfraPermission } from '$lib/server/permissions';
import { audit, listAuditEventsFor } from './audit.service';
import { queryActivityPage, recordEvent } from './activity.service';
import { queryMembersPage } from './members.service';
import { clampPage, pageOffset, PAGE_SIZE, type Page } from '$lib/shared/utils/pagination';
import type {
	OrgCounts,
	OrgFilters,
	OrgInvitation,
	OrgInviteLink,
	OrgMember,
	PlatformOrgDetail,
	PlatformOrgRow
} from '$lib/shared/types/platform-organizations';
import type { ActivityEntry } from '$lib/shared/types/activity';
import type { AuditEntry } from '$lib/shared/types/audit';

/** Whether the member role column (comma-separated) includes owner. */
const isOwner = (alias: string) => `'owner' = ANY(string_to_array(replace(${alias}.role, ' ', ''), ','))`;

const ROW_COLUMNS = `
	o.id, o.name, o.slug, o.created_at, o.suspended_at, o.deleted_at,
	(SELECT COUNT(*) FROM auth.member m WHERE m.organization_id = o.id) AS member_count,
	(SELECT COUNT(*) FROM auth.invitation i WHERE i.organization_id = o.id AND i.status = 'pending') AS pending_invitations,
	(SELECT json_build_object('id', u.id, 'name', u.name)
	 FROM auth.member m JOIN auth.user u ON u.id = m.user_id
	 WHERE m.organization_id = o.id AND ${isOwner('m')}
	 ORDER BY m.created_at LIMIT 1) AS owner,
	(SELECT max(d.day) FROM user_activity_day d WHERE d.org_key = o.id::text) AS last_active_day,
	(SELECT COUNT(*) FROM activity_event e WHERE e.org_id = o.id AND e.occurred_at > now() - interval '30 days') AS events_30d`;

interface OrgRowRecord {
	id: string;
	name: string;
	slug: string;
	created_at: Date;
	suspended_at: Date | null;
	deleted_at: Date | null;
	member_count: string;
	pending_invitations: string;
	owner: { id: string; name: string } | null;
	last_active_day: string | Date | null;
	events_30d: string;
}

function day(value: string | Date | null): string | null {
	if (!value) return null;
	return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toRow(r: OrgRowRecord): PlatformOrgRow {
	return {
		id: r.id,
		name: r.name,
		slug: r.slug,
		createdAt: r.created_at.toISOString(),
		memberCount: Number(r.member_count),
		pendingInvitations: Number(r.pending_invitations),
		owner: r.owner,
		lastActiveDay: day(r.last_active_day),
		events30d: Number(r.events_30d),
		suspended: r.suspended_at !== null,
		deleted: r.deleted_at !== null
	};
}

function likePattern(term: string): string {
	return `%${term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const RECENTLY_ACTIVE = `EXISTS (SELECT 1 FROM user_activity_day d WHERE d.org_key = o.id::text AND d.day >= current_date - 90)`;

function filterSql(filters: OrgFilters) {
	const clauses: string[] = [];
	const params: unknown[] = [];

	if (filters.q) {
		params.push(likePattern(filters.q));
		clauses.push(`(lower(o.name) LIKE $${params.length} OR lower(o.slug) LIKE $${params.length})`);
	}

	switch (filters.status) {
		case 'deleted':
			clauses.push('o.deleted_at IS NOT NULL');
			break;
		case 'suspended':
			clauses.push('o.deleted_at IS NULL AND o.suspended_at IS NOT NULL');
			break;
		case 'active':
			clauses.push(`o.deleted_at IS NULL AND o.suspended_at IS NULL AND ${RECENTLY_ACTIVE}`);
			break;
		case 'inactive':
			clauses.push(`o.deleted_at IS NULL AND NOT ${RECENTLY_ACTIVE}`);
			break;
		default:
			clauses.push('o.deleted_at IS NULL');
	}

	return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

/**
 * How each sort orders the rows. `key` is computed for every matching org,
 * since sorting needs it; the list's other columns are computed only for the
 * page shown.
 */
const SORTS: Record<NonNullable<OrgFilters['sort']>, { key: string; order: string }> = {
	newest: { key: 'NULL', order: 'p.created_at DESC, p.id' },
	oldest: { key: 'NULL', order: 'p.created_at ASC, p.id' },
	members: {
		key: '(SELECT COUNT(*) FROM auth.member m WHERE m.organization_id = o.id)',
		order: 'p.sort_key DESC, p.created_at DESC, p.id'
	},
	recently_active: {
		key: '(SELECT max(d.day) FROM user_activity_day d WHERE d.org_key = o.id::text)',
		order: 'p.sort_key DESC NULLS LAST, p.created_at DESC, p.id'
	},
	name: { key: 'lower(o.name)', order: 'p.sort_key, p.id' }
};

/** One page of organizations. No access check; callers have made one. */
export async function queryOrgsPage(
	filters: OrgFilters,
	requested: number,
	pageSize = PAGE_SIZE
): Promise<Page<PlatformOrgRow>> {
	const { where, params } = filterSql(filters);

	const count = await POOL.query<{ count: string }>(`SELECT COUNT(*) AS count FROM auth.organization o ${where}`, params);
	const totalCount = Number(count.rows[0]?.count ?? 0);
	const page = clampPage(requested, totalCount, pageSize);

	const sort = SORTS[filters.sort ?? 'newest'];
	const result = await POOL.query<OrgRowRecord>(
		`WITH p AS (
		   SELECT o.id, o.created_at, ${sort.key} AS sort_key
		   FROM auth.organization o
		   ${where}
		   ORDER BY ${sort.order.replace(/p\./g, '')}
		   LIMIT $${params.length + 1} OFFSET $${params.length + 2}
		 )
		 SELECT ${ROW_COLUMNS}
		 FROM p JOIN auth.organization o ON o.id = p.id
		 ORDER BY ${sort.order}`,
		[...params, pageSize, pageOffset(page, pageSize)]
	);

	return { items: result.rows.map(toRow), totalCount, page, pageSize };
}

/** The organizations list. 403 without `access`. */
export async function listOrgs(userId: string, filters: OrgFilters, page: number): Promise<Page<PlatformOrgRow>> {
	await requireInfraPermission(userId, 'access');
	return queryOrgsPage(filters, page);
}

async function findOrg(orgId: string): Promise<OrgRowRecord & { suspended_reason: string | null }> {
	const result = await POOL.query<OrgRowRecord & { suspended_reason: string | null }>(
		`SELECT ${ROW_COLUMNS}, o.suspended_reason FROM auth.organization o WHERE o.id = $1`,
		[orgId]
	);
	if (!result.rows[0]) throw error(404, 'Organization not found.');
	return result.rows[0];
}

/** One organization: who runs it, how big and how active it is. 403 without `access`. */
export async function getOrg(userId: string, orgId: string): Promise<PlatformOrgDetail> {
	await requireInfraPermission(userId, 'access');
	const org = await findOrg(orgId);

	const platform = await POOL.query<{
		active: string;
		dormant: string;
		never: string;
		created_by: { id: string; name: string } | null;
	}>(
		`WITH last AS (
		   SELECT m.user_id, (SELECT max(d.day) FROM user_activity_day d
		                      WHERE d.user_id = m.user_id AND d.org_key = $1::text) AS day
		   FROM auth.member m WHERE m.organization_id = $1
		 )
		 SELECT
		   (SELECT COUNT(*) FROM last WHERE day >= current_date - 30) AS active,
		   (SELECT COUNT(*) FROM last WHERE day < current_date - 30) AS dormant,
		   (SELECT COUNT(*) FROM last WHERE day IS NULL) AS never,
		   (SELECT json_build_object('id', u.id, 'name', u.name)
		    FROM activity_event e JOIN auth.user u ON u.id = e.user_id
		    WHERE e.type = 'org.created' AND e.org_id = $1 LIMIT 1) AS created_by`,
		[orgId]
	);

	// Universe rows, role names, and plugins are behind org RLS.
	const inside = await withOrgTransaction(orgId, async (client) => {
		const counts = await client.query<Record<string, string>>(
			`SELECT
			   (SELECT COUNT(*) FROM universe.org_entity WHERE org_id = $1) AS records,
			   (SELECT COUNT(*) FROM universe.bucket WHERE org_id = $1) AS buckets,
			   (SELECT COUNT(*) FROM universe.list WHERE org_id = $1) AS lists,
			   (SELECT COUNT(*) FROM universe.turf WHERE org_id = $1) AS turfs,
			   (SELECT COUNT(*) FROM universe.survey WHERE org_id = $1) AS surveys,
			   (SELECT COUNT(*) FROM universe.turf_location_attempt WHERE org_id = $1) AS visits,
			   (SELECT COUNT(*) FROM universe.turf_location_attempt WHERE org_id = $1 AND created_at > now() - interval '30 days') AS visits_30d,
			   (SELECT COUNT(*) FROM universe.turf_location_attempt WHERE org_id = $1 AND contact_made) AS conversations,
			   (SELECT COUNT(*) FROM universe.list_document WHERE org_id = $1 AND deleted_at IS NULL AND status = 'ready') AS documents`,
			[orgId]
		);
		const leaders = await client.query<{ user_id: string; name: string; email: string; owner: boolean; role_name: string | null }>(
			`SELECT m.user_id, u.name, u.email, ${isOwner('m')} AS owner,
			        (SELECT pr.name FROM user_role_membership urm
			         JOIN permission_role pr ON pr.id = urm.role_id
			         WHERE urm.member_id = m.id AND pr.organization_id = $1 AND pr.is_default = false
			         ORDER BY pr.weight LIMIT 1) AS role_name
			 FROM auth.member m
			 JOIN auth.user u ON u.id = m.user_id
			 WHERE m.organization_id = $1
			   AND (${isOwner('m')} OR EXISTS (
			     SELECT 1 FROM user_role_membership urm
			     JOIN permission_role pr ON pr.id = urm.role_id
			     WHERE urm.member_id = m.id AND pr.organization_id = $1 AND pr.weight = 0))
			 ORDER BY ${isOwner('m')} DESC, lower(u.name)
			 LIMIT 20`,
			[orgId]
		);
		const plugins = await client.query<{ plugin_slug: string; enabled: boolean; created_at: Date }>(
			`SELECT plugin_slug, enabled, created_at FROM plugin_installation WHERE organization_id = $1 ORDER BY plugin_slug`,
			[orgId]
		);
		return { counts: counts.rows[0], leaders: leaders.rows, plugins: plugins.rows };
	});

	const c = inside.counts;
	const activity = platform.rows[0];
	const counts: OrgCounts = {
		members: Number(org.member_count),
		activeMembers30d: Number(activity.active),
		records: Number(c.records),
		buckets: Number(c.buckets),
		lists: Number(c.lists),
		turfs: Number(c.turfs),
		surveys: Number(c.surveys),
		visits: Number(c.visits),
		visits30d: Number(c.visits_30d),
		conversations: Number(c.conversations),
		documents: Number(c.documents)
	};

	return {
		...toRow(org),
		suspendedAt: org.suspended_at?.toISOString() ?? null,
		suspendedReason: org.suspended_reason,
		deletedAt: org.deleted_at?.toISOString() ?? null,
		leaders: inside.leaders.map((l) => ({
			userId: l.user_id,
			name: l.name,
			email: l.email,
			owner: l.owner,
			roleName: l.role_name
		})),
		createdBy: activity.created_by ?? org.owner,
		plugins: inside.plugins.map((p) => ({ slug: p.plugin_slug, enabled: p.enabled, installedAt: p.created_at.toISOString() })),
		counts,
		memberActivity: { active: Number(activity.active), dormant: Number(activity.dormant), never: Number(activity.never) }
	};
}

/** The org's members, by name, with their role and last activity there. 403 without `access`. */
export async function listOrgMembers(userId: string, orgId: string, requested: number): Promise<Page<OrgMember>> {
	await requireInfraPermission(userId, 'access');
	await findOrg(orgId);

	// The same query the staff members page and GET /api/v1/organizations/[id]/members use.
	const members = await withOrgTransaction(orgId, (client) => queryMembersPage(client, orgId, requested));
	return {
		...members,
		items: members.items.map((r) => ({
			memberId: r.member_id,
			userId: r.id,
			name: r.name,
			email: r.email,
			memberRole: r.member_role,
			roleName: r.role_name,
			joinedAt: new Date(r.joined_at).toISOString(),
			lastActiveDay: r.last_active_day
		}))
	};
}

/** Pending invitations and open invite links. 403 without `access`. */
export async function listOrgInvitations(
	userId: string,
	orgId: string
): Promise<{ invitations: OrgInvitation[]; links: OrgInviteLink[] }> {
	await requireInfraPermission(userId, 'access');
	await findOrg(orgId);

	const [invitations, links] = await Promise.all([
		POOL.query<{ id: string; email: string; role: string | null; status: string; inviter_name: string | null; created_at: Date }>(
			`SELECT i.id, i.email, i.role, i.status, u.name AS inviter_name, i.created_at
			 FROM auth.invitation i
			 LEFT JOIN auth.user u ON u.id = i.inviter_id
			 WHERE i.organization_id = $1 AND i.status = 'pending'
			 ORDER BY i.created_at DESC
			 LIMIT 200`,
			[orgId]
		),
		POOL.query<{ id: string; created_by: string | null; created_at: Date; expires_at: Date | null }>(
			`SELECT l.id, u.name AS created_by, l.created_at, l.expires_at
			 FROM org_invite_link l
			 LEFT JOIN auth.user u ON u.id = l.created_by
			 WHERE l.org_id = $1 AND (l.expires_at IS NULL OR l.expires_at > now())
			 ORDER BY l.created_at DESC
			 LIMIT 200`,
			[orgId]
		)
	]);

	return {
		invitations: invitations.rows.map((r) => ({
			id: r.id,
			email: r.email,
			role: r.role,
			status: r.status,
			inviterName: r.inviter_name,
			createdAt: r.created_at.toISOString()
		})),
		links: links.rows.map((r) => ({
			id: r.id,
			createdBy: r.created_by,
			createdAt: r.created_at.toISOString(),
			expiresAt: r.expires_at?.toISOString() ?? null
		}))
	};
}

export async function listOrgActivity(userId: string, orgId: string, page: number): Promise<Page<ActivityEntry>> {
	await requireInfraPermission(userId, 'access');
	return queryActivityPage({ orgId }, page);
}

export async function listOrgAudit(userId: string, orgId: string, page: number): Promise<Page<AuditEntry>> {
	return listAuditEventsFor(userId, { type: 'organization', id: orgId }, page);
}

/** Members of a suspended org get a "suspended" page instead of the org. */
export async function suspendOrg(userId: string, orgId: string, reason: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');
	const org = await findOrg(orgId);
	if (org.deleted_at) throw error(409, 'This organization was deleted. Restore it first.');
	if (org.suspended_at) throw error(409, 'This organization is already suspended.');

	await withTransaction(async (client) => {
		await client.query(`UPDATE auth.organization SET suspended_at = now(), suspended_reason = $2 WHERE id = $1`, [orgId, reason]);
		await audit(userId, 'org.suspend', { type: 'organization', id: orgId }, { name: org.name, reason }, client);
	});
}

export async function unsuspendOrg(userId: string, orgId: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');
	const org = await findOrg(orgId);
	if (!org.suspended_at) throw error(409, 'This organization is not suspended.');

	await withTransaction(async (client) => {
		await client.query(`UPDATE auth.organization SET suspended_at = NULL, suspended_reason = NULL WHERE id = $1`, [orgId]);
		await audit(userId, 'org.unsuspend', { type: 'organization', id: orgId }, { name: org.name }, client);
	});
}

/**
 * Soft-deletes the org: it disappears for its members, its data stays, and an
 * admin can restore it. `confirmSlug` must match the org's slug.
 */
export async function deleteOrg(userId: string, orgId: string, confirmSlug: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');
	const org = await findOrg(orgId);
	if (org.deleted_at) throw error(409, 'This organization is already deleted.');
	if (confirmSlug.trim().toLowerCase() !== org.slug.toLowerCase()) {
		throw error(400, 'Type the organization slug exactly to confirm.');
	}

	await withTransaction(async (client) => {
		await client.query(`UPDATE auth.organization SET deleted_at = now() WHERE id = $1`, [orgId]);
		await audit(userId, 'org.delete', { type: 'organization', id: orgId }, { name: org.name, slug: org.slug }, client);
	});
}

export async function restoreOrg(userId: string, orgId: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');
	const org = await findOrg(orgId);
	if (!org.deleted_at) throw error(409, 'This organization is not deleted.');

	await withTransaction(async (client) => {
		await client.query(`UPDATE auth.organization SET deleted_at = NULL WHERE id = $1`, [orgId]);
		await audit(userId, 'org.restore', { type: 'organization', id: orgId }, { name: org.name }, client);
	});
}

/**
 * Makes a member the org's owner, for an org whose owner has gone. They get
 * the owner flag and the Administrator role; the previous owners become
 * admins and keep their roles.
 */
export async function transferOwnership(userId: string, orgId: string, memberId: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');
	const org = await findOrg(orgId);
	if (org.deleted_at) throw error(409, 'This organization was deleted. Restore it first.');

	await withOrgTransaction(orgId, async (client) => {
		const member = await client.query<{ user_id: string; role: string; name: string }>(
			`SELECT m.user_id, m.role, u.name FROM auth.member m JOIN auth.user u ON u.id = m.user_id
			 WHERE m.id = $1 AND m.organization_id = $2`,
			[memberId, orgId]
		);
		if (!member.rows[0]) throw error(404, 'That person is not a member of this organization.');
		const target = member.rows[0];

		const previous = await client.query<{ user_id: string }>(
			`UPDATE auth.member m SET role = 'admin'
			 WHERE m.organization_id = $1 AND m.id <> $2 AND ${isOwner('m')}
			 RETURNING m.user_id`,
			[orgId, memberId]
		);
		await client.query(`UPDATE auth.member SET role = 'owner' WHERE id = $1`, [memberId]);

		const adminRole = await client.query<{ id: string }>(
			`SELECT id FROM permission_role
			 WHERE organization_id = $1 AND scope = 'organization'
			 ORDER BY weight LIMIT 1`,
			[orgId]
		);
		if (adminRole.rows[0]) {
			await client.query(
				`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (user_id, role_id) DO NOTHING`,
				[target.user_id, memberId, adminRole.rows[0].id, userId]
			);
		}
		await audit(
			userId,
			'org.ownership.transfer',
			{ type: 'organization', id: orgId },
			{ name: org.name, newOwner: target.user_id, newOwnerName: target.name, previousOwners: previous.rows.map((r) => r.user_id) },
			client
		);
	});
}

/** Removes someone from an org. 409 when they are its only owner. */
export async function removeMember(userId: string, memberId: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');

	const found = await POOL.query<{ organization_id: string; user_id: string; role: string; name: string }>(
		`SELECT m.organization_id, m.user_id, m.role, u.name
		 FROM auth.member m JOIN auth.user u ON u.id = m.user_id WHERE m.id = $1`,
		[memberId]
	);
	const member = found.rows[0];
	if (!member) throw error(404, 'Member not found.');

	const memberIsOwner = member.role.split(',').map((r) => r.trim()).includes('owner');

	await withOrgTransaction(member.organization_id, async (client) => {
		if (memberIsOwner) {
			// Locking the owner rows makes two removals of the last two owners
			// take turns, so the second sees the first and is refused.
			const owners = await client.query(
				`SELECT m.id FROM auth.member m WHERE m.organization_id = $1 AND ${isOwner('m')} FOR UPDATE`,
				[member.organization_id]
			);
			if ((owners.rowCount ?? 0) <= 1) {
				throw error(409, 'This is the only owner. Transfer ownership to someone else first.');
			}
		}
		await client.query(`DELETE FROM user_role_membership WHERE member_id = $1`, [memberId]);
		await client.query(`DELETE FROM auth.member WHERE id = $1 AND organization_id = $2`, [memberId, member.organization_id]);
		await audit(
			userId,
			'org.member.remove',
			{ type: 'organization', id: member.organization_id },
			{ userId: member.user_id, name: member.name },
			client
		);
	});

	await recordEvent('member.left', {
		userId: member.user_id,
		orgId: member.organization_id,
		metadata: { removedBy: userId }
	});
}

/** Cancels a pending invitation. */
export async function cancelInvitation(userId: string, invitationId: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');

	await withTransaction(async (client) => {
		const result = await client.query<{ organization_id: string; email: string }>(
			`UPDATE auth.invitation SET status = 'canceled', updated_at = now()
			 WHERE id = $1 AND status = 'pending'
			 RETURNING organization_id, email`,
			[invitationId]
		);
		if (!result.rows[0]) throw error(404, 'No pending invitation with that id.');

		await audit(
			userId,
			'org.invitation.cancel',
			{ type: 'organization', id: result.rows[0].organization_id },
			{ email: result.rows[0].email },
			client
		);
	});
}

/** Closes an invite link so it can no longer be used to join. */
export async function revokeInviteLink(userId: string, linkId: string): Promise<void> {
	await requireInfraPermission(userId, 'orgs.manage');

	await withTransaction(async (client) => {
		const result = await client.query<{ org_id: string }>(
			`UPDATE org_invite_link SET expires_at = now()
			 WHERE id = $1 AND (expires_at IS NULL OR expires_at > now())
			 RETURNING org_id`,
			[linkId]
		);
		if (!result.rows[0]) throw error(404, 'No open invite link with that id.');

		await audit(userId, 'org.invite_link.revoke', { type: 'organization', id: result.rows[0].org_id }, { linkId }, client);
	});
}
