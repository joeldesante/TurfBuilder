/** Every infrastructure permission key, as seeded in `registered_permission`. */
export const INFRA_PERMISSIONS = [
	'access',
	'users.manage',
	'users.impersonate',
	'orgs.manage',
	'settings.manage',
	'audit.read',
	'locations.overture_sync'
] as const;

export type InfraPermission = (typeof INFRA_PERMISSIONS)[number];

/** A link to a tool outside the app, such as analytics or tracing. */
export interface ExternalLink {
	label: string;
	url: string;
}
