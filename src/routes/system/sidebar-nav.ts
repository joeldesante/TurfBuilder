import type { SidebarNavEntry } from '$components/layout/sidebar/types';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
import ListBulletsIcon from 'phosphor-svelte/lib/ListBullets';
import ScissorsIcon from 'phosphor-svelte/lib/Scissors';
import UsersIcon from 'phosphor-svelte/lib/Users';
import UserIcon from 'phosphor-svelte/lib/User';
import DatabaseIcon from 'phosphor-svelte/lib/Database';
import MapPinIcon from 'phosphor-svelte/lib/MapPin';
import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';
import WrenchIcon from 'phosphor-svelte/lib/Wrench';
import BellIcon from 'phosphor-svelte/lib/Bell';
import LockIcon from 'phosphor-svelte/lib/Lock';

export const systemNav: SidebarNavEntry[] = [
	{
		kind: 'item',
		item: { label: 'Dashboard', href: '/system/', icon: SquaresFourIcon }
	},
	{
		kind: 'section',
		section: {
			label: 'Turf',
			icon: MapTrifoldIcon,
			items: [
				{ label: 'Overview', href: '/system/turfs', icon: ListBulletsIcon },
				{ label: 'Cut Turf', href: '/system/turfs/cut', icon: ScissorsIcon }
			]
		}
	},
	{
		kind: 'section',
		section: {
			label: 'People',
			icon: UsersIcon,
			items: [{ label: 'Users', href: '/system/users', icon: UserIcon }]
		}
	},
	{
		kind: 'section',
		section: {
			label: 'Data',
			icon: DatabaseIcon,
			items: [
				{ label: 'Locations', href: '/system/data/locations', icon: MapPinIcon },
				{ label: 'Surveys', href: '/system/data/surveys', icon: ClipboardTextIcon }
			]
		}
	},
	{
		kind: 'section',
		section: {
			label: 'Utilities',
			icon: WrenchIcon,
			items: [
				{ label: 'Send Notification', href: '/system/utils/notify', icon: BellIcon },
				{ label: 'Lockdown', href: '/system/utils/lockdown', icon: LockIcon }
			]
		}
	}
];
