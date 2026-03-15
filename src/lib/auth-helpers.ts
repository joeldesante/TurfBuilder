export function hasSystemAccess(userRole: string | null | undefined): boolean {
	if (!userRole) return false;
	const allowedRoles = ['fieldOrganizer', 'campaignManager', 'admin'];
	const userRoles = userRole.split(',').map((r) => r.trim());
	return userRoles.some((role) => allowedRoles.includes(role));
}

export function can(
	org: App.Locals['organization'],
	resource: string,
	action: string
): boolean {
	if (!org?.role) return false;
	if (org.role.is_owner) return true;
	return org.role.permissions.includes(`${resource}:${action}`);
}
