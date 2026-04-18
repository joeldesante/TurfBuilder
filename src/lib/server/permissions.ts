import type { PoolClient } from 'pg';
import { POOL } from './database';

/**
 * Resolves the effective organization-scoped permissions for a user.
 *
 * Resolution order (highest to lowest priority):
 *   1. Direct user_permission entries — always win
 *   2. Among groups the user belongs to, the heaviest group (lowest weight) wins per key
 *
 * Returns only the keys where the resolved value is true (effective grants).
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
		group_perms AS (
			SELECT
				rp.key,
				pge.value,
				ROW_NUMBER() OVER (PARTITION BY rp.key ORDER BY pg.weight ASC) AS rn
			FROM user_group_membership ugm
			JOIN permission_group pg ON pg.id = ugm.group_id
			JOIN permission_group_entry pge ON pge.group_id = pg.id
			JOIN registered_permission rp ON rp.id = pge.registered_permission_id
			WHERE ugm.user_id = $1
			  AND pg.organization_id = $2
			  AND pg.scope = 'organization'
		),
		best_group AS (
			SELECT key, value FROM group_perms WHERE rn = 1
		),
		resolved AS (
			SELECT key, value FROM user_direct
			UNION ALL
			SELECT key, value FROM best_group
			WHERE key NOT IN (SELECT key FROM user_direct)
		)
		SELECT key FROM resolved WHERE value = true`,
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
		group_perms AS (
			SELECT
				rp.key,
				pge.value,
				ROW_NUMBER() OVER (PARTITION BY rp.key ORDER BY pg.weight ASC) AS rn
			FROM user_group_membership ugm
			JOIN permission_group pg ON pg.id = ugm.group_id
			JOIN permission_group_entry pge ON pge.group_id = pg.id
			JOIN registered_permission rp ON rp.id = pge.registered_permission_id
			WHERE ugm.user_id = $1
			  AND pg.scope = 'infrastructure'
		),
		best_group AS (
			SELECT key, value FROM group_perms WHERE rn = 1
		),
		resolved AS (
			SELECT key, value FROM user_direct
			UNION ALL
			SELECT key, value FROM best_group
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
