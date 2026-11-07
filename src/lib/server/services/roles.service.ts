import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission, requireRoleOrg } from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';
import { VALID_PERMISSION_KEYS } from '$lib/permissions-config';
import type { CreateRoleInput } from '$lib/shared/schemas/roles';
import type { Role, RoleOption } from '$lib/shared/types/roles';

/**
 * Permission roles. A role grants a set of registered permission keys to the
 * members holding it. The default role (Everyone) cannot be renamed or
 * deleted, and the administrator role (weight 0) always keeps system.access.
 */

/** Every column of a role plus the keys it grants, sorted. */
const ROLE_SELECT = `
	SELECT pr.id, pr.organization_id, pr.name, pr.is_default, pr.weight,
	       COALESCE(
	           array_agg(rp.key ORDER BY rp.key)
	           FILTER (WHERE pre.value = true AND rp.key IS NOT NULL),
	           ARRAY[]::text[]
	       ) AS permissions
	FROM permission_role pr
	LEFT JOIN permission_role_entry pre ON pre.role_id = pr.id
	LEFT JOIN registered_permission rp ON rp.id = pre.registered_permission_id`;

const DEFAULT_WEIGHT = 500;

async function requirePermission(client: PoolClient, userId: string, orgId: string, key: string) {
	if (!(await canOrg(client, userId, orgId, key))) throw error(403, 'Forbidden');
}

/** The org's roles, highest priority first. 404 unless the caller is a member, 403 without `role.read`. */
export async function listRoles(userId: string, orgId: string): Promise<Role[]> {
	await requireOrgPermission(userId, orgId, 'role.read');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<Role>(
			`${ROLE_SELECT}
			 WHERE pr.organization_id = $1
			 GROUP BY pr.id
			 ORDER BY pr.weight ASC, pr.id`,
			[orgId]
		);
		return result.rows;
	});
}

/**
 * The roles a member can be given, for the role picker on the members page.
 * Needs `member.read`, the same as the page, not `role.read`.
 */
export async function listRoleOptions(userId: string, orgId: string): Promise<RoleOption[]> {
	await requireOrgPermission(userId, orgId, 'member.read');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<RoleOption>(
			`SELECT id, name FROM permission_role
			 WHERE organization_id = $1 AND scope = 'organization'
			 ORDER BY weight ASC, id`,
			[orgId]
		);
		return result.rows;
	});
}

/** One role. 404 when it is in none of the caller's orgs, 403 without `role.read`. */
export async function getRole(userId: string, roleId: string): Promise<Role> {
	const orgId = await requireRoleOrg(userId, roleId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'role.read');

		const result = await client.query<Role>(
			`${ROLE_SELECT}
			 WHERE pr.id = $1 AND pr.organization_id = $2
			 GROUP BY pr.id`,
			[roleId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Role not found');
		return result.rows[0];
	});
}

/** Creates a role that grants nothing yet. 404 unless the caller is a member, 403 without `role.create`. */
export async function createRole(
	userId: string,
	orgId: string,
	input: CreateRoleInput
): Promise<Role> {
	await requireOrgPermission(userId, orgId, 'role.create');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<Omit<Role, 'permissions'>>(
			`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
			 VALUES ($1, $2, 'organization', $3, false)
			 RETURNING id, organization_id, name, is_default, weight`,
			[input.name, input.weight ?? DEFAULT_WEIGHT, orgId]
		);
		return { ...result.rows[0], permissions: [] };
	});
}

/** Renames a role. 409 for the default role, which keeps its name. */
export async function renameRole(userId: string, roleId: string, name: string): Promise<Role> {
	const orgId = await requireRoleOrg(userId, roleId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'role.update');

		const result = await client.query<{ is_default: boolean }>(
			`UPDATE permission_role SET name = $1
			 WHERE id = $2 AND organization_id = $3
			 RETURNING is_default`,
			[name, roleId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Role not found');
		// Checked after the update so the transaction rolls it back.
		if (result.rows[0].is_default) throw error(409, 'The default role cannot be renamed.');

		return readRole(client, orgId, roleId);
	});
}

/** Deletes a role; its members keep their other roles. 409 for the default role. */
export async function deleteRole(userId: string, roleId: string): Promise<void> {
	const orgId = await requireRoleOrg(userId, roleId);

	await withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'role.delete');

		const role = await client.query<{ is_default: boolean }>(
			`SELECT is_default FROM permission_role WHERE id = $1 AND organization_id = $2`,
			[roleId, orgId]
		);
		if (role.rowCount === 0) throw error(404, 'Role not found');
		if (role.rows[0].is_default) throw error(409, 'The default role cannot be deleted.');

		await client.query(`DELETE FROM permission_role WHERE id = $1 AND organization_id = $2`, [
			roleId,
			orgId
		]);
	});
}

/**
 * Makes the role grant exactly these permission keys. The administrator role
 * keeps `system.access` even when it is left out. 400 for an unknown key.
 */
export async function replaceRolePermissions(
	userId: string,
	roleId: string,
	keys: string[]
): Promise<Role> {
	const unknown = keys.find((k) => !VALID_PERMISSION_KEYS.has(k));
	if (unknown !== undefined) throw error(400, `Invalid permission: ${unknown}`);

	const orgId = await requireRoleOrg(userId, roleId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'role.update');

		const role = await client.query<{ weight: number }>(
			`SELECT weight FROM permission_role WHERE id = $1 AND organization_id = $2`,
			[roleId, orgId]
		);
		if (role.rowCount === 0) throw error(404, 'Role not found');

		const isAdmin = role.rows[0].weight === 0;
		const effective = [...new Set(isAdmin ? [...keys, 'system.access'] : keys)];

		await client.query(`DELETE FROM permission_role_entry WHERE role_id = $1`, [roleId]);
		if (effective.length > 0) {
			await client.query(
				`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
				 SELECT $1, id, true FROM registered_permission WHERE key = ANY($2::text[])`,
				[roleId, effective]
			);
		}

		return readRole(client, orgId, roleId);
	});
}

async function readRole(client: PoolClient, orgId: string, roleId: string): Promise<Role> {
	const result = await client.query<Role>(
		`${ROLE_SELECT}
		 WHERE pr.id = $1 AND pr.organization_id = $2
		 GROUP BY pr.id`,
		[roleId, orgId]
	);
	return result.rows[0];
}
