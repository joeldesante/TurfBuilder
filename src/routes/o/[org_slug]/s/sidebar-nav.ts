import type { SidebarNavEntry } from '$components/layout/sidebar/types';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
import UserIcon from 'phosphor-svelte/lib/User';
import UsersIcon from 'phosphor-svelte/lib/Users';
import MapPinIcon from 'phosphor-svelte/lib/MapPin';
import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';
import ChartBarIcon from 'phosphor-svelte/lib/ChartBar';
import ShieldIcon from 'phosphor-svelte/lib/Shield';
import GearIcon from 'phosphor-svelte/lib/Gear';

export function buildStaffNav(orgSlug: string): SidebarNavEntry[] {
	return [
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
					{ label: 'Roles', href: `/o/${orgSlug}/s/settings/roles`, icon: ShieldIcon }
				]
			}
		}
	];
}
