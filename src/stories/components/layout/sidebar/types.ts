import type { Component } from 'svelte';

export interface SidebarNavItem {
	label: string;
	href: string;
	icon?: Component;
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
