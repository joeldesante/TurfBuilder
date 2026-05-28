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
import ListBulletsIcon from 'phosphor-svelte/lib/ListBullets';

interface ActivePlugin {
	navEntries: SidebarNavEntry[];
	requiredPermission?: { resource: string; action: string };
}

interface BucketFilter {
	people: { enabled: boolean };
	locations: { enabled: boolean };
}

interface Bucket {
	id: string;
	name: string;
	slug: string;
	filter?: BucketFilter;
}

export function buildBucketNav(orgSlug: string, bucketSlug: string, filter?: BucketFilter): SidebarNavEntry[] {
	const base = `/o/${orgSlug}/s/universe/buckets/${bucketSlug}`;
	return [
		{
			kind: 'section',
			section: {
				label: 'Entities',
				icon: GlobeIcon,
				items: [
					...(filter?.people.enabled ? [{ label: 'People', href: `${base}/people`, icon: UsersIcon }] : []),
					...(filter?.locations.enabled ? [{ label: 'Locations', href: `${base}/locations`, icon: MapPinIcon }] : []),
					{ label: 'Scripts', href: `${base}/scripts`, icon: ScrollIcon },
					{ label: 'Surveys', href: `${base}/surveys`, icon: ClipboardTextIcon }
				]
			}
		},
		{
			kind: 'section',
			section: {
				label: 'Data',
				icon: FilesIcon,
				items: [
					{ label: 'Lists', href: `${base}/lists`, icon: ListBulletsIcon }
				]
			}
		}
	];
}

export function buildStaffNav(
	orgSlug: string,
	plugins: ActivePlugin[] = [],
	org?: App.Locals['organization'],
	buckets: Bucket[] = []
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
							...buckets.map((b) => ({
								label: b.name,
								href: `/o/${orgSlug}/s/universe/buckets/${b.slug}`,
								icon: CircleIcon
							})),
							{ label: 'Create New Bucket', href: `/o/${orgSlug}/s/universe/buckets/new`, icon: PlusIcon }
						]
					},
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
