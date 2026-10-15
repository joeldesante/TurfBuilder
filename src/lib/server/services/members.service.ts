import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';

export interface MemberRow {
	id: string;
	name: string;
	email: string;
	role_id: string | null;
	role_name: string | null;
}

/**
 * One page of the org's members by name, each with their highest-priority
 * non-default role. For callers that already hold an org transaction and have
 * checked `member.read`.
 */
export async function queryMembersPage(
	client: PoolClient,
	orgId: string,
	requested: number
): Promise<Page<MemberRow>> {
	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM auth.member WHERE organization_id = $1`,
		[orgId]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);

	// DISTINCT ON picks the lowest-weight (highest-priority) non-default role per
	// user; it needs ORDER BY u.id, so the page order is applied outside it, with
	// an id tiebreak so pages cannot repeat or skip a member.
	const rows = await client.query<MemberRow>(
		`SELECT * FROM (
			SELECT DISTINCT ON (u.id) u.id, u.name, u.email, pr.id AS role_id, pr.name AS role_name
			  FROM auth.member m
			  JOIN auth."user" u ON u.id = m.user_id
			  LEFT JOIN user_role_membership urm ON urm.user_id = m.user_id
			  LEFT JOIN permission_role pr
			    ON pr.id = urm.role_id
			   AND pr.organization_id = m.organization_id
			   AND pr.scope = 'organization'
			   AND pr.is_default = false
			 WHERE m.organization_id = $1
			 ORDER BY u.id, pr.weight ASC NULLS LAST
		) members
		ORDER BY lower(name), id
		LIMIT $2 OFFSET $3`,
		[orgId, PAGE_SIZE, pageOffset(page)]
	);

	return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
}

/** One page of the org's members. 404 unless the caller is a member, 403 without `member.read`. */
export async function listMembers(
	userId: string,
	orgId: string,
	requested: number
): Promise<Page<MemberRow>> {
	await requireOrgPermission(userId, orgId, 'member.read');

	return withOrgTransaction(orgId, (client) => queryMembersPage(client, orgId, requested));
}
