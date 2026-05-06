import type { SidebarNavEntry } from '$components/layout/sidebar/types';
import { can } from '$lib/auth-helpers';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
import MapPinIcon from 'phosphor-svelte/lib/MapPinIcon';
import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardTextIcon';
import ChartBarIcon from 'phosphor-svelte/lib/ChartBar';
import ShieldIcon from 'phosphor-svelte/lib/Shield';
import GearIcon from 'phosphor-svelte/lib/GearIcon';
import PuzzlePieceIcon from 'phosphor-svelte/lib/PuzzlePiece';
import GlobeIcon from 'phosphor-svelte/lib/Globe';
import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
import FilesIcon from 'phosphor-svelte/lib/FilesIcon';
import StackIcon from 'phosphor-svelte/lib/Stack';
import CircleIcon from 'phosphor-svelte/lib/Circle';
import PlusIcon from 'phosphor-svelte/lib/Plus';
import ScrollIcon from 'phosphor-svelte/lib/ScrollIcon';
import SlidersIcon from 'phosphor-svelte/lib/SlidersIcon';

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
			kind: 'section',
			section: {
				label: 'Universe',
				icon: GlobeIcon,
				items: [
					{ label: 'Quick Search', href: `/o/${orgSlug}/s/universe/search`, icon: MagnifyingGlassIcon },
					{
						label: 'Buckets',
						icon: StackIcon,
						defaultOpen: true,
						items: [
							{ label: 'Registered Voters', href: `/o/${orgSlug}/s/universe/buckets/registered-voters`, icon: CircleIcon },
							{ label: 'Likely Democrats', href: `/o/${orgSlug}/s/universe/buckets/likely-democrats`, icon: CircleIcon },
							{ label: 'High Priority Doors', href: `/o/${orgSlug}/s/universe/buckets/high-priority-doors`, icon: CircleIcon },
							{ label: 'First Time Voters', href: `/o/${orgSlug}/s/universe/buckets/first-time-voters`, icon: CircleIcon },
							{ label: 'Create New Bucket', href: `/o/${orgSlug}/s/universe/buckets/new`, icon: PlusIcon }
						]
					},
					{ label: 'Scripts', href: `/o/${orgSlug}/s/universe/scripts`, icon: ScrollIcon },
					{ label: 'Surveys', href: `/o/${orgSlug}/s/data/surveys`, icon: ClipboardTextIcon },
					{ label: 'Reports', href: `/o/${orgSlug}/s/universe/reports`, icon: FilesIcon },
				]
			}
		},
		{
			kind: 'section',
			section: {
				label: 'Organization',
				icon: UsersIcon,
				items: [
					{ label: 'Members', href: `/o/${orgSlug}/s/members`, icon: UsersIcon },
					{ label: 'Roles', href: `/o/${orgSlug}/s/settings/roles`, icon: ShieldIcon },
					{ label: 'Universe Data Manager', href: `/o/${orgSlug}/s/universe/manage`, icon: SlidersIcon },
					...(can(org, 'plugin', 'manage')
						? [{ label: 'Plugins', href: `/o/${orgSlug}/s/plugins`, icon: PuzzlePieceIcon }]
						: [])
				]
			}
		},
		{
			kind: 'section',
			section: {
				label: 'Settings',
				icon: GearIcon,
				items: [
					...(can(org, 'location', 'create')
						? [{ label: 'Import Locations', href: `/o/${orgSlug}/s/settings/locations`, icon: MapPinIcon }]
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
