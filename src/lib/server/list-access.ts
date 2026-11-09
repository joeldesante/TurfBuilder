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

/** The org a script belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireScriptOrg(userId: string, scriptId: string): Promise<string> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query(
			`SELECT 1 FROM universe.script WHERE id = $1 AND org_id = $2`,
			[scriptId, orgId]
		);
		return result.rowCount ? true : undefined;
	});
	if (!found) throw error(404, 'Script not found');

	return found.orgId;
}

/** The org a permission role belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireRoleOrg(userId: string, roleId: string): Promise<string> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query(
			`SELECT 1 FROM permission_role WHERE id = $1 AND organization_id = $2`,
			[roleId, orgId]
		);
		return result.rowCount ? true : undefined;
	});
	if (!found) throw error(404, 'Role not found');

	return found.orgId;
}

/**
 * The org and user of a membership. Throws 404 unless the membership is in one
 * of the caller's orgs, so another org's member ids look like unknown ones.
 */
export async function requireMemberOrg(
	userId: string,
	memberId: string
): Promise<{ orgId: string; memberUserId: string; memberRole: string }> {
	const result = await POOL.query<{ organization_id: string; user_id: string; role: string }>(
		`SELECT target.organization_id, target.user_id, target.role
		 FROM auth.member target
		 JOIN auth.member caller
		   ON caller.organization_id = target.organization_id AND caller.user_id = $2
		 JOIN auth.organization o ON o.id = target.organization_id
		 WHERE target.id = $1 AND o.deleted_at IS NULL AND o.suspended_at IS NULL`,
		[memberId, userId]
	);
	const row = result.rows[0];
	if (!row) throw error(404, 'Member not found');

	return { orgId: row.organization_id, memberUserId: row.user_id, memberRole: row.role };
}

/**
 * The caller's membership in an org they may use. Throws 404 unless they are a
 * member, so another org's id looks the same as one that does not exist; a
 * deleted org is treated as missing, and a suspended one answers 403.
 */
export async function requireActiveMembership(
	userId: string,
	orgId: string
): Promise<{ role: string }> {
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

/** Runs `sql` (one row or none, the id as $1 and the org as $2) in each of the user's orgs. */
async function findOrgOf(userId: string, sql: string, id: string): Promise<string | null> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query(sql, [id, orgId]);
		return result.rowCount ? true : undefined;
	});
	return found?.orgId ?? null;
}

/**
 * The org a location belongs to, by its entity id. Throws 404 unless it is a
 * live contact in one of the user's orgs.
 */
export async function requireLocationOrg(userId: string, entityId: string): Promise<string> {
	const orgId = await findOrgOf(
		userId,
		`SELECT 1 FROM universe.org_contact WHERE entity_id = $1 AND org_id = $2 AND valid_to IS NULL`,
		entityId
	);
	if (!orgId) throw error(404, 'Location not found');
	return orgId;
}

/** The org a turf belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireTurfOrg(userId: string, turfId: string): Promise<string> {
	const orgId = await findOrgOf(
		userId,
		`SELECT 1 FROM universe.turf WHERE id = $1 AND org_id = $2`,
		turfId
	);
	if (!orgId) throw error(404, 'Turf not found');
	return orgId;
}

/** The org and turf of a turf door. Throws 404 unless it is in one of the user's orgs. */
export async function requireDoorOrg(
	userId: string,
	doorId: string
): Promise<{ orgId: string; turfId: string }> {
	const found = await findInMemberOrgs(userId, async (client, orgId) => {
		const result = await client.query<{ turf_id: string }>(
			`SELECT turf_id FROM universe.turf_location WHERE id = $1 AND org_id = $2`,
			[doorId, orgId]
		);
		return result.rows[0]?.turf_id;
	});
	if (!found) throw error(404, 'Door not found');
	return { orgId: found.orgId, turfId: found.row };
}

/** The org a volunteer's location suggestion belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireSuggestionOrg(userId: string, suggestionId: string): Promise<string> {
	const orgId = await findOrgOf(
		userId,
		`SELECT 1 FROM universe.location_suggestion WHERE id = $1 AND org_id = $2`,
		suggestionId
	);
	if (!orgId) throw error(404, 'Suggestion not found');
	return orgId;
}

/** The org a canvasser's location correction belongs to. Throws 404 unless it is in one of the user's orgs. */
export async function requireLocationEditOrg(userId: string, editId: string): Promise<string> {
	const orgId = await findOrgOf(
		userId,
		`SELECT 1 FROM universe.location_edit_suggestion WHERE id = $1 AND org_id = $2`,
		editId
	);
	if (!orgId) throw error(404, 'Correction not found');
	return orgId;
}
