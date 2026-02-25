import type { SidebarNavEntry } from '$components/layout/sidebar/types';
import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour';
import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
import UserIcon from 'phosphor-svelte/lib/User';
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
		kind: 'item',
		item: { label: 'Turfs', href: '/system/turfs', icon: MapTrifoldIcon }
	},
	{
		kind: 'item',
		item: { label: 'Users', href: '/system/users', icon: UserIcon }
	},
	{
		kind: 'item',
		item: { label: 'Locations', href: '/system/data/locations', icon: MapPinIcon }
	},
	{
		kind: 'item',
		item: { label: 'Surveys', href: '/system/data/surveys', icon: ClipboardTextIcon }
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
