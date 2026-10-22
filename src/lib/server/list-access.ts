import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { canOrg } from '$lib/server/permissions';

const uuidSchema = z.uuid();

/** Throws 401 when signed out. */
export function requireUser(locals: App.Locals): string {
	if (!locals.user) throw error(401, 'Unauthorized');
	return locals.user.id;
}

/** Throws 400 unless the route parameter is a uuid. */
export function parseId(value: string | undefined, name: string): string {
	const parsed = uuidSchema.safeParse(value);
	if (!parsed.success) throw error(400, `Invalid ${name} id`);
	return parsed.data;
}

/**
 * The /api/v1 routes below the organization level name a resource but not its
 * org, and RLS hides a row from every transaction but its own org's. So this
 * runs `find` in each org the user is a member of and returns the first hit.
 * Returns null when none of the user's orgs has it, which callers report as
 * 404 so ids in other orgs are not revealed.
 */
async function findInMemberOrgs<T>(
	userId: string,
	find: (client: PoolClient, orgId: string) => Promise<T | undefined>
): Promise<{ orgId: string; row: T } | null> {
	// Suspended and deleted orgs are left out, so their rows answer 404 like any other org's.
	const orgs = await POOL.query<{ organization_id: string }>(
		`SELECT m.organization_id
		 FROM auth.member m
		 JOIN auth.organization o ON o.id = m.organization_id
		 WHERE m.user_id = $1 AND o.deleted_at IS NULL AND o.suspended_at IS NULL`,
		[userId]
	);

	for (const { organization_id: orgId } of orgs.rows) {
		const row = await withOrgTransaction(orgId, (client) => find(client, orgId));
		if (row !== undefined) return { orgId, row };
	}
	return null;
}

/** The org a list belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireListOrg(userId: string, listId: string): Promise<string> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query(`SELECT 1 FROM universe.list WHERE id = $1 AND org_id = $2`, [
			listId,
			orgId
		]);
		return result.rowCount ? true : undefined;
	});
	if (!found) throw error(404, 'List not found');

	return found.orgId;
}

/**
 * The org and list a list document belongs to. Throws 404 unless it is in one
 * of the user's orgs and not soft-deleted.
 */
export async function requireDocumentOrg(
	userId: string,
	documentId: string
): Promise<{ orgId: string; listId: string }> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query<{ list_id: string }>(
			`SELECT list_id FROM universe.list_document
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[documentId, orgId]
		);
		return result.rows[0]?.list_id;
	});
	if (!found) throw error(404, 'Document not found');

	return { orgId: found.orgId, listId: found.row };
}

/**
 * Throws 403 without staff access to the org and 404 when the list is not in
 * it. The /api/v1 routes sit outside /o/[org_slug], so hooks.server.ts has not
 * resolved the org for them; system.access is what the staff layout requires
 * to reach the list pages. Must run inside withOrgTransaction.
 */
export async function requireListAccess(
	client: PoolClient,
	userId: string,
	orgId: string,
	listId: string
): Promise<{ name: string }> {
	if (!(await canOrg(client, userId, orgId, 'system.access'))) {
		throw error(403, 'Forbidden');
	}

	const list = await client.query<{ name: string }>(
		`SELECT name FROM universe.list WHERE id = $1 AND org_id = $2`,
		[listId, orgId]
	);
	if (list.rowCount === 0) throw error(404, 'List not found');

	return list.rows[0];
}

/** The org a bucket belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireBucketOrg(userId: string, bucketId: string): Promise<string> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query(
			`SELECT 1 FROM universe.bucket WHERE id = $1 AND org_id = $2`,
			[bucketId, orgId]
		);
		return result.rowCount ? true : undefined;
	});
	if (!found) throw error(404, 'Bucket not found');

	return found.orgId;
}

/** The org a survey belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireSurveyOrg(userId: string, surveyId: string): Promise<string> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query(
			`SELECT 1 FROM universe.survey WHERE id = $1 AND org_id = $2`,
			[surveyId, orgId]
		);
		return result.rowCount ? true : undefined;
	});
	if (!found) throw error(404, 'Survey not found');

	return found.orgId;
}

/**
 * The caller's membership in an org they may use. Throws 404 unless they are a
 * member, so another org's id looks the same as one that does not exist; a
 * deleted org is treated as missing, and a suspended one answers 403.
 */
export async function requireActiveMembership(userId: string, orgId: string): Promise<{ role: string }> {
	const result = await POOL.query<{ role: string; suspended: boolean; deleted: boolean }>(
		`SELECT m.role, o.suspended_at IS NOT NULL AS suspended, o.deleted_at IS NOT NULL AS deleted
		 FROM auth.member m
		 JOIN auth.organization o ON o.id = m.organization_id
		 WHERE m.user_id = $1 AND m.organization_id = $2`,
		[userId, orgId]
	);
	const row = result.rows[0];
	if (!row || row.deleted) throw error(404, 'Organization not found');
	if (row.suspended) throw error(403, 'This organization has been suspended.');
	return { role: row.role };
}

/**
 * Throws 404 unless the user is a member of the org (403 when it is
 * suspended), then 403 without the permission.
 */
export async function requireOrgPermission(
	userId: string,
	orgId: string,
	permission: string
): Promise<void> {
	await requireActiveMembership(userId, orgId);

	const allowed = await withOrgTransaction(orgId, (client) =>
		canOrg(client, userId, orgId, permission)
	);
	if (!allowed) throw error(403, 'Forbidden');
}
