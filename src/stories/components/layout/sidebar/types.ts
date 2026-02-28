import type { Component } from 'svelte';

export interface SidebarNavItem {
	label: string;
	href: string;
	icon?: Component;
}

export interface SidebarNavSection {
	label: string;
	icon?: Component;
	items: SidebarNavItem[];
}

export type SidebarNavEntry =
	| { kind: 'item'; item: SidebarNavItem }
	| { kind: 'section'; section: SidebarNavSection };
