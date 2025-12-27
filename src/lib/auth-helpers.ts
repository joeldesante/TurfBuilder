export function hasSystemAccess(userRole: string | null | undefined): boolean {
  if (!userRole) return false;
  const allowedRoles = ['fieldOrganizer', 'campaignManager'];
  const userRoles = userRole.split(',').map(r => r.trim());
  return userRoles.some(role => allowedRoles.includes(role));
}