import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { POOL } from './database';
import type { InfraPermission } from '$lib/shared/types/infra';

/**
 * Resolves the effective organization-scoped permissions for a user.
 *
 * Resolution order (highest to lowest priority):
 *   1. Direct user_permission entries — always win
 *   2. Among roles the user belongs to, the heaviest role (lowest weight) wins per key
 *
 * Returns only the keys where the resolved value is true (effective grants).
 * A suspended or deleted org grants nothing, so every canOrg check on it fails
 * wherever it is made.
 * Must be called inside a withOrgTransaction so RLS is scoped to the correct org.
 */
export async function resolveOrgPermissions(
	client: PoolClient,
	userId: string,
	orgId: string
): Promise<string[]> {
	const result = await client.query(
		`WITH
		user_direct AS (
			SELECT rp.key, up.value
			FROM user_permission up
			JOIN registered_permission rp ON rp.id = up.registered_permission_id
			WHERE up.user_id = $1
			  AND up.organization_id = $2
			  AND rp.scope = 'organization'
		),
		role_perms AS (
			SELECT
				rp.key,
				pre.value,
				ROW_NUMBER() OVER (PARTITION BY rp.key ORDER BY pr.weight ASC) AS rn
			FROM user_role_membership urm
			JOIN permission_role pr ON pr.id = urm.role_id
			JOIN permission_role_entry pre ON pre.role_id = pr.id
			JOIN registered_permission rp ON rp.id = pre.registered_permission_id
			WHERE urm.user_id = $1
			  AND pr.organization_id = $2
			  AND pr.scope = 'organization'
		),
		best_role AS (
			SELECT key, value FROM role_perms WHERE rn = 1
		),
		resolved AS (
			SELECT key, value FROM user_direct
			UNION ALL
			SELECT key, value FROM best_role
			WHERE key NOT IN (SELECT key FROM user_direct)
		)
		SELECT key FROM resolved
		WHERE value = true
		  AND EXISTS (
		    SELECT 1 FROM auth.organization o
		    WHERE o.id = $2 AND o.deleted_at IS NULL AND o.suspended_at IS NULL
		  )`,
		[userId, orgId]
	);

	return result.rows.map((r) => r.key);
}

/**
 * Resolves the effective infrastructure-scoped permissions for a user.
 *
 * Same resolution algorithm as resolveOrgPermissions but without an org context —
 * infra permissions use organization_id IS NULL.
 *
 * Can be called outside of a withOrgTransaction.
 */
export async function resolveInfraPermissions(userId: string): Promise<string[]> {
	const result = await POOL.query(
		`WITH
		user_direct AS (
			SELECT rp.key, up.value
			FROM user_permission up
			JOIN registered_permission rp ON rp.id = up.registered_permission_id
			WHERE up.user_id = $1
			  AND up.organization_id IS NULL
			  AND rp.scope = 'infrastructure'
		),
		role_perms AS (
			SELECT
				rp.key,
				pre.value,
				ROW_NUMBER() OVER (PARTITION BY rp.key ORDER BY pr.weight ASC) AS rn
			FROM user_role_membership urm
			JOIN permission_role pr ON pr.id = urm.role_id
			JOIN permission_role_entry pre ON pre.role_id = pr.id
			JOIN registered_permission rp ON rp.id = pre.registered_permission_id
			WHERE urm.user_id = $1
			  AND pr.scope = 'infrastructure'
		),
		best_role AS (
			SELECT key, value FROM role_perms WHERE rn = 1
		),
		resolved AS (
			SELECT key, value FROM user_direct
			UNION ALL
			SELECT key, value FROM best_role
			WHERE key NOT IN (SELECT key FROM user_direct)
		)
		SELECT key FROM resolved WHERE value = true`,
		[userId]
	);

	return result.rows.map((r) => r.key);
}

/**
 * Returns true if the user has the given infrastructure permission.
 *
 * Usage:
 *   if (!await canInfra(locals.user.id, 'access')) throw error(403, 'Forbidden');
 */
export async function canInfra(userId: string, permission: string): Promise<boolean> {
	const permissions = await resolveInfraPermissions(userId);
	return permissions.includes(permission);
}

/**
 * Throws 403 unless the user has the given infrastructure permission. Infra
 * services call it first, the way org services call canOrg, so every endpoint
 * and page load that reaches them is checked.
 */
export async function requireInfraPermission(userId: string, permission: InfraPermission): Promise<void> {
	if (!(await canInfra(userId, permission))) throw error(403, 'Forbidden');
}

/**
 * Returns true if the user has the given organization permission.
 * Must be called inside a withOrgTransaction.
 *
 * Usage:
 *   if (!await canOrg(client, locals.user.id, locals.organization.id, 'turf.create')) throw error(403, 'Forbidden');
 */
export async function canOrg(
	client: PoolClient,
	userId: string,
	orgId: string,
	permission: string
): Promise<boolean> {
	const permissions = await resolveOrgPermissions(client, userId, orgId);
	return permissions.includes(permission);
}
