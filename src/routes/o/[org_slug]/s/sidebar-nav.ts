import type { SidebarNavEntry } from '$components/layout/sidebar/types';
import { can } from '$lib/auth-helpers';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
import UserIcon from 'phosphor-svelte/lib/User';
import UsersIcon from 'phosphor-svelte/lib/Users';
import MapPinIcon from 'phosphor-svelte/lib/MapPin';
import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';
import ChartBarIcon from 'phosphor-svelte/lib/ChartBar';
import ShieldIcon from 'phosphor-svelte/lib/Shield';
import GearIcon from 'phosphor-svelte/lib/Gear';
import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';

interface ActivePlugin {
	navEntries: SidebarNavEntry[];
	requiredPermission?: { resource: string; action: string };
}

export function buildStaffNav(
	orgSlug: string,
	plugins: ActivePlugin[] = [],
	org?: App.Locals['organization']
): SidebarNavEntry[] {
	const coreNav: SidebarNavEntry[] = [
		{
			kind: 'item',
			item: { label: 'Dashboard', href: `/o/${orgSlug}/s/`, icon: SquaresFourIcon }
		},
		{
			kind: 'item',
			item: { label: 'Turfs', href: `/o/${orgSlug}/s/turfs`, icon: MapTrifoldIcon }
		},
		{
			kind: 'item',
			item: { label: 'Members', href: `/o/${orgSlug}/s/members`, icon: UsersIcon }
		},
		{
			kind: 'item',
			item: { label: 'Users', href: `/o/${orgSlug}/s/users`, icon: UserIcon }
		},
		{
			kind: 'item',
			item: { label: 'Locations', href: `/o/${orgSlug}/s/data/locations`, icon: MapPinIcon }
		},
		{
			kind: 'item',
			item: { label: 'Surveys', href: `/o/${orgSlug}/s/data/surveys`, icon: ClipboardTextIcon }
		},
		{
			kind: 'item',
			item: { label: 'Responses', href: `/o/${orgSlug}/s/data/responses`, icon: ChartBarIcon }
		},
		{
			kind: 'section',
			section: {
				label: 'Settings',
				icon: GearIcon,
				items: [
					{ label: 'Roles', href: `/o/${orgSlug}/s/settings/roles`, icon: ShieldIcon },
					...(can(org, 'plugin', 'manage')
						? [{ label: 'Plugins', href: `/o/${orgSlug}/s/plugins`, icon: PuzzlePieceIcon }]
						: [])
				]
			}
		}
	];

	const pluginNav = plugins.flatMap((p) => {
		if (p.requiredPermission && !can(org, p.requiredPermission.resource, p.requiredPermission.action)) {
			return [];
		}
		return p.navEntries;
	});

	return [...coreNav, ...pluginNav];
}
