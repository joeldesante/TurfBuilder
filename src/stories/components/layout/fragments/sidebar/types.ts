import type { Component } from 'svelte';

export interface SidebarNavItem {
	label: string;
	href: string;
	icon?: Component;
	/** Count shown in a badge after the label. */
	badge?: number;
	/** What the badge counts, read after the exact number by screen readers and shown in the tooltip, e.g. "locations matching the current filters". */
	badgeLabel?: string;
}

export interface SidebarNavAccordion {
	label: string;
	icon?: Component;
	items: SidebarNavItem[];
	defaultOpen?: boolean;
}

export type SidebarNavSectionEntry =
	| SidebarNavItem
	| SidebarNavAccordion;

export interface SidebarNavSection {
	label: string;
	icon?: Component;
	items: SidebarNavSectionEntry[];
}

export type SidebarNavEntry =
	| { kind: 'item'; item: SidebarNavItem }
	| { kind: 'section'; section: SidebarNavSection };
