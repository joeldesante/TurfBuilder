import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import { requireInfraPermission, resolveInfraPermissions } from '$lib/server/permissions';
import { audit } from './audit.service';
import type { InfraAdmin, InfraRole } from '$lib/shared/types/infra-admins';

/**
 * Users holding any infrastructure role or direct infrastructure grant. Infra
 * roles have no org, so RLS shows their rows without an org context.
 */
async function candidateIds(): Promise<string[]> {
	const result = await POOL.query<{ user_id: string }>(
		`SELECT urm.user_id
		 FROM user_role_membership urm
		 JOIN permission_role pr ON pr.id = urm.role_id
		 WHERE pr.scope = 'infrastructure'
		 UNION
		 SELECT up.user_id
		 FROM user_permission up
		 JOIN registered_permission rp ON rp.id = up.registered_permission_id
		 WHERE up.organization_id IS NULL AND rp.scope = 'infrastructure'`
	);
	return result.rows.map((r) => r.user_id);
}

/**
 * Users who can still run the infra panel: they have `access` and
 * `users.manage`, so they could grant the rest back. The panel never removes
 * the last of them.
 */
export async function fullAdminIds(): Promise<string[]> {
	const ids = await candidateIds();
	const resolved = await Promise.all(ids.map(async (id) => ({ id, perms: await resolveInfraPermissions(id) })));
	return resolved.filter((r) => r.perms.includes('access') && r.perms.includes('users.manage')).map((r) => r.id);
}

/** Throws 409 when removing `userId`'s admin rights would leave nobody who can manage the panel. */
export async function requireNotLastAdmin(userId: string, what: string): Promise<void> {
	const admins = await fullAdminIds();
	if (admins.length === 1 && admins[0] === userId) {
		throw error(409, `This is the last infrastructure admin who can manage users, so they cannot be ${what}.`);
	}
}

/**
 * Throws 403 unless the actor holds every infrastructure permission in
 * `permissions`. Holding users.manage lets an admin change accounts and roles,
 * so without this they could grant themselves more, or take over a stronger
 * admin's account by changing its email and sending a reset.
 */
export async function requireHoldsAll(actorId: string, permissions: string[], message: string): Promise<void> {
	if (permissions.length === 0) return;
	const held = new Set(await resolveInfraPermissions(actorId));
	if (permissions.some((p) => !held.has(p))) throw error(403, message);
}

/**
 * Throws 403 when the target has infrastructure permissions the actor lacks,
 * for any change to how the target signs in or what they can do.
 */
export async function requireNotStronger(actorId: string, targetId: string): Promise<void> {
	await requireHoldsAll(
		actorId,
		await resolveInfraPermissions(targetId),
		'This account has infrastructure permissions you do not have, so you cannot change it.'
	);
}

/** Every infrastructure role and the permissions it grants. 403 without `users.manage`. */
export async function listInfraRoles(userId: string): Promise<InfraRole[]> {
	await requireInfraPermission(userId, 'users.manage');
	const result = await POOL.query<{ id: string; name: string; weight: number; permissions: string[] | null; holders: string }>(
		`SELECT pr.id, pr.name, pr.weight,
		        array_agg(rp.key ORDER BY rp.key) FILTER (WHERE pre.value) AS permissions,
		        (SELECT COUNT(*) FROM user_role_membership urm WHERE urm.role_id = pr.id) AS holders
		 FROM permission_role pr
		 LEFT JOIN permission_role_entry pre ON pre.role_id = pr.id
		 LEFT JOIN registered_permission rp ON rp.id = pre.registered_permission_id
		 WHERE pr.scope = 'infrastructure'
		 GROUP BY pr.id
		 ORDER BY pr.weight`
	);
	return result.rows.map((r) => ({
		id: r.id,
		name: r.name,
		weight: r.weight,
		permissions: r.permissions ?? [],
		holderCount: Number(r.holders)
	}));
}

/** Everyone with infrastructure rights, with their roles and resolved permissions. 403 without `users.manage`. */
export async function listInfraAdmins(userId: string): Promise<InfraAdmin[]> {
	await requireInfraPermission(userId, 'users.manage');
	const ids = await candidateIds();
	if (ids.length === 0) return [];

	const users = await POOL.query<{
		id: string;
		name: string;
		email: string;
		roles: { id: string; name: string; grantedAt: string; grantedBy: string | null }[] | null;
	}>(
		`SELECT u.id, u.name, u.email,
		        (SELECT json_agg(json_build_object('id', pr.id, 'name', pr.name,
		                                           'grantedAt', urm.created_at, 'grantedBy', g.name)
		                         ORDER BY pr.weight)
		         FROM user_role_membership urm
		         JOIN permission_role pr ON pr.id = urm.role_id AND pr.scope = 'infrastructure'
		         LEFT JOIN auth.user g ON g.id = urm.granted_by
		         WHERE urm.user_id = u.id) AS roles
		 FROM auth.user u
		 WHERE u.id = ANY($1)
		 ORDER BY u.name`,
		[ids]
	);

	const full = new Set(await fullAdminIds());
	return Promise.all(
		users.rows.map(async (u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			roles: u.roles ?? [],
			permissions: await resolveInfraPermissions(u.id),
			canManageAdmins: full.has(u.id)
		}))
	);
}

/** One user's infrastructure roles. 403 without `users.manage`; 404 for an unknown user. */
export async function listUserInfraRoles(userId: string, targetId: string): Promise<{ id: string; name: string }[]> {
	await requireInfraPermission(userId, 'users.manage');
	const user = await POOL.query(`SELECT 1 FROM auth.user WHERE id = $1`, [targetId]);
	if (!user.rowCount) throw error(404, 'User not found.');

	const result = await POOL.query<{ id: string; name: string }>(
		`SELECT pr.id, pr.name FROM user_role_membership urm
		 JOIN permission_role pr ON pr.id = urm.role_id AND pr.scope = 'infrastructure'
		 WHERE urm.user_id = $1
		 ORDER BY pr.weight`,
		[targetId]
	);
	return result.rows;
}

/** The permissions an infrastructure role grants. */
async function rolePermissions(roleId: string): Promise<string[]> {
	const result = await POOL.query<{ key: string }>(
		`SELECT rp.key FROM permission_role_entry pre
		 JOIN registered_permission rp ON rp.id = pre.registered_permission_id
		 WHERE pre.role_id = $1 AND pre.value`,
		[roleId]
	);
	return result.rows.map((r) => r.key);
}

/** Gives a user an infrastructure role. 403 without `users.manage`, or when the role grants a permission the giver lacks; 404 for an unknown user or role. */
export async function grantInfraRole(userId: string, targetId: string, roleId: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');

	const target = await POOL.query(`SELECT 1 FROM auth.user WHERE id = $1 AND deleted_at IS NULL`, [targetId]);
	if (!target.rowCount) throw error(404, 'User not found.');
	const role = await POOL.query<{ name: string }>(
		`SELECT name FROM permission_role WHERE id = $1 AND scope = 'infrastructure'`,
		[roleId]
	);
	if (!role.rowCount) throw error(404, 'Role not found.');
	await requireHoldsAll(userId, await rolePermissions(roleId), 'You cannot give a role with permissions you do not have.');

	const inserted = await POOL.query(
		`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by)
		 VALUES ($1, NULL, $2, $3)
		 ON CONFLICT (user_id, role_id) DO NOTHING`,
		[targetId, roleId, userId]
	);
	if (inserted.rowCount) {
		await audit(userId, 'infra_role.grant', { type: 'user', id: targetId }, { roleId, roleName: role.rows[0].name });
	}
}

/** Takes an infrastructure role away. 403 when the holder has permissions the remover lacks; 409 when it would leave no admin who can manage users. */
export async function revokeInfraRole(userId: string, targetId: string, roleId: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');

	const membership = await POOL.query<{ name: string }>(
		`SELECT pr.name FROM user_role_membership urm
		 JOIN permission_role pr ON pr.id = urm.role_id AND pr.scope = 'infrastructure'
		 WHERE urm.user_id = $1 AND urm.role_id = $2`,
		[targetId, roleId]
	);
	if (!membership.rowCount) throw error(404, 'The user does not have that role.');
	await requireNotStronger(userId, targetId);

	// Permissions resolve through roles, direct grants, and weights, so the
	// simplest exact check is to remove the role, resolve again, and put it back
	// if nobody could manage users any more.
	await POOL.query(`DELETE FROM user_role_membership WHERE user_id = $1 AND role_id = $2`, [targetId, roleId]);

	if ((await fullAdminIds()).length === 0) {
		await POOL.query(
			`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by) VALUES ($1, NULL, $2, $3)
			 ON CONFLICT (user_id, role_id) DO NOTHING`,
			[targetId, roleId, userId]
		);
		throw error(409, 'That would leave no infrastructure admin who can manage users.');
	}

	await audit(userId, 'infra_role.revoke', { type: 'user', id: targetId }, { roleId, roleName: membership.rows[0].name });
}
