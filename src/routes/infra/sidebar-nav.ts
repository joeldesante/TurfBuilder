import type { SidebarNavEntry } from '$components/layout/sidebar/types';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import UsersIcon from 'phosphor-svelte/lib/Users';
import DatabaseIcon from 'phosphor-svelte/lib/Database';

export function buildInfraNav(infraPermissions: string[]): SidebarNavEntry[] {
	const nav: SidebarNavEntry[] = [
		{
			kind: 'item',
			item: { label: 'Dashboard', href: '/infra', icon: SquaresFourIcon }
		}
	];

	if (infraPermissions.includes('users.manage')) {
		nav.push({
			kind: 'item',
			item: { label: 'Users', href: '/infra/users', icon: UsersIcon }
		});
	}

	if (infraPermissions.includes('locations.overture_sync')) {
		nav.push({
			kind: 'item',
			item: { label: 'Data Sync', href: '/infra/sync', icon: DatabaseIcon }
		});
	}

	return nav;
}
