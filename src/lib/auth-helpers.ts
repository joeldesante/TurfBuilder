export function hasSystemAccess(userRole: string | null | undefined): boolean {
	if (!userRole) return false;
	const allowedRoles = ['admin'];
	const userRoles = userRole.split(',').map((r) => r.trim());
	return userRoles.some((role) => allowedRoles.includes(role));
}

/**
 * Checks whether the current org member has a specific permission.
 *
 * Permissions are resolved in hooks.server.ts using the unified permission system:
 *   1. Direct user_permission overrides win unconditionally
 *   2. Among groups the user belongs to, the heaviest group (lowest weight) wins
 *
 * Usage:
 *   if (!can(locals.organization, 'turf', 'create')) throw error(403, 'Forbidden');
 */
export function can(
	org: App.Locals['organization'],
	resource: string,
	action: string
): boolean {
	if(!org) return false;
	console.log(org.permissions)
	const canTheUserDoIt = org.permissions.includes(`${resource}.${action}`);
	console.log(`User has "${resource}.${action}": ${canTheUserDoIt}`)
	return canTheUserDoIt;
}

/**
 * Checks whether the current user has a specific infrastructure permission.
 *
 * Usage:
 *   if (!hasInfraPermission(locals.infraPermissions, 'access')) throw error(403, 'Forbidden');
 */
export function hasInfraPermission(infraPermissions: string[], permission: string): boolean {
	return infraPermissions.includes(permission);
}
