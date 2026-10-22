import type { ExternalLink, InfraPermission } from '$lib/shared/types/infra';

/** Icon names; the components that draw the nav map them to Phosphor icons. */
export type InfraNavIcon =
	| 'overview'
	| 'metrics'
	| 'organizations'
	| 'users'
	| 'admins'
	| 'audit'
	| 'settings'
	| 'email'
	| 'email-log'
	| 'health'
	| 'migrate'
	| 'external';

export interface InfraNavLink {
	label: string;
	href: string;
	icon: InfraNavIcon;
	/** Opens outside the app, in a new tab. */
	external?: boolean;
}

export interface InfraNavGroup {
	/** Null for the top group, which has no heading. */
	label: string | null;
	links: InfraNavLink[];
}

interface Entry extends InfraNavLink {
	permission: InfraPermission;
}

const PAGES: { label: string | null; entries: Entry[] }[] = [
	{
		label: null,
		entries: [
			{ label: 'Overview', href: '/infra', icon: 'overview', permission: 'access' },
			{ label: 'Metrics', href: '/infra/metrics', icon: 'metrics', permission: 'access' },
			{ label: 'Organizations', href: '/infra/orgs', icon: 'organizations', permission: 'access' },
			{ label: 'Users', href: '/infra/users', icon: 'users', permission: 'access' }
		]
	},
	{
		label: 'Administration',
		entries: [
			{ label: 'Admins', href: '/infra/admins', icon: 'admins', permission: 'users.manage' },
			{ label: 'Audit log', href: '/infra/audit', icon: 'audit', permission: 'audit.read' }
		]
	},
	{
		label: 'Settings',
		entries: [
			{ label: 'General', href: '/infra/settings', icon: 'settings', permission: 'settings.manage' },
			{ label: 'Email templates', href: '/infra/settings/email/templates', icon: 'email', permission: 'settings.manage' },
			{ label: 'Email log', href: '/infra/settings/email/log', icon: 'email-log', permission: 'settings.manage' }
		]
	},
	{
		label: 'System',
		entries: [
			{ label: 'Health', href: '/infra/system', icon: 'health', permission: 'access' },
			{ label: 'Migrate', href: '/infra/migrate', icon: 'migrate', permission: 'settings.manage' }
		]
	}
];

/**
 * The infra pages the user can open, grouped as the sidebar shows them, then
 * the external tools. Groups the user can open nothing in are left out.
 */
export function buildInfraNav(permissions: readonly string[], externalLinks: ExternalLink[] = []): InfraNavGroup[] {
	if (!permissions.includes('access')) return [];

	const groups: InfraNavGroup[] = PAGES.map((group) => ({
		label: group.label,
		links: group.entries
			.filter((entry) => permissions.includes(entry.permission))
			.map(({ permission: _permission, ...link }) => link)
	})).filter((group) => group.links.length > 0);

	if (externalLinks.length > 0) {
		groups.push({
			label: 'External tools',
			links: externalLinks.map((link) => ({ label: link.label, href: link.url, icon: 'external', external: true }))
		});
	}

	return groups;
}

/** Whether `href` is the nav entry for `path`: exact for the overview, by prefix for the rest. */
export function isInfraNavActive(href: string, path: string, allHrefs: string[]): boolean {
	const norm = (value: string) => (value.endsWith('/') ? value : `${value}/`);
	const target = norm(href);
	const current = norm(path);
	// A link whose href begins another link's (Settings before its email pages)
	// only matches exactly, so the longer one wins.
	const prefixOfOther = allHrefs.some((other) => norm(other) !== target && norm(other).startsWith(target));
	return prefixOfOther ? current === target : current.startsWith(target);
}
