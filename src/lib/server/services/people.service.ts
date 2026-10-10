import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/server/pagination';
import type { Page } from '$lib/server/pagination';

export interface OrgPersonRow {
	id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	phone: string | null;
	dob: string | null;
}

// There are no person.* permission keys yet, so people use the staff check.
const PERMISSION = 'system.access';

/**
 * One page of the org's current people, by last then first name. For callers
 * that already hold an org transaction and have checked staff access.
 *
 * valid_to IS NULL keeps superseded versions out, so each person appears once.
 */
export async function queryOrgPeoplePage(
	client: PoolClient,
	orgId: string,
	requested: number
): Promise<Page<OrgPersonRow>> {
	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count
		   FROM universe.org_person
		  WHERE org_id = $1 AND valid_to IS NULL`,
		[orgId]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);

	// The id tiebreak makes the order total, so pages cannot repeat or skip a row.
	const rows = await client.query<OrgPersonRow>(
		`SELECT id, first_name, last_name, email, phone, dob
		   FROM universe.org_person
		  WHERE org_id = $1 AND valid_to IS NULL
		  ORDER BY last_name NULLS LAST, first_name NULLS LAST, id
		  LIMIT $2 OFFSET $3`,
		[orgId, PAGE_SIZE, pageOffset(page)]
	);

	return { items: rows.rows, totalCount, page, pageSize: PAGE_SIZE };
}

/** One page of the org's people. 404 unless the caller is a member, 403 without staff access. */
export async function listOrgPeople(
	userId: string,
	orgId: string,
	requested: number
): Promise<Page<OrgPersonRow>> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, (client) => queryOrgPeoplePage(client, orgId, requested));
}
