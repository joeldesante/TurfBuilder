import type { InfraPermission } from '$lib/shared/types/infra';

/** What each infrastructure permission lets an admin do, in words. */
export const INFRA_PERMISSION_LABELS: Record<InfraPermission, string> = {
	access: 'Open the infrastructure panel',
	'users.manage': 'Manage users and admins',
	'users.impersonate': 'Impersonate users',
	'orgs.manage': 'Manage organizations',
	'settings.manage': 'Change settings and run migrations',
	'audit.read': 'Read the audit log',
	'locations.overture_sync': 'Run the Overture data sync'
};

export function infraPermissionLabel(key: string): string {
	return INFRA_PERMISSION_LABELS[key as InfraPermission] ?? key;
}
