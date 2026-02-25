<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Sidebar from './Sidebar.svelte'
	import type { SidebarNavEntry } from './types'
	import SquaresFourIcon from 'phosphor-svelte/lib/SquaresFour'
	import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold'
	import UserIcon from 'phosphor-svelte/lib/User'
	import MapPinIcon from 'phosphor-svelte/lib/MapPin'
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText'
	import WrenchIcon from 'phosphor-svelte/lib/Wrench'
	import BellIcon from 'phosphor-svelte/lib/Bell'
	import LockIcon from 'phosphor-svelte/lib/Lock'

	const sampleNav: SidebarNavEntry[] = [
		{
			kind: 'item',
			item: { label: 'Dashboard', href: '/system/', icon: SquaresFourIcon },
		},
		{
			kind: 'item',
			item: { label: 'Turfs', href: '/system/turfs', icon: MapTrifoldIcon },
		},
		{
			kind: 'item',
			item: { label: 'Users', href: '/system/users', icon: UserIcon },
		},
		{
			kind: 'item',
			item: { label: 'Locations', href: '/system/data/locations', icon: MapPinIcon },
		},
		{
			kind: 'item',
			item: { label: 'Surveys', href: '/system/data/surveys', icon: ClipboardTextIcon },
		},
		{
			kind: 'section',
			section: {
				label: 'Utilities',
				icon: WrenchIcon,
				items: [
					{ label: 'Send Notification', href: '/system/utils/notify', icon: BellIcon },
					{ label: 'Lockdown', href: '/system/utils/lockdown', icon: LockIcon },
				],
			},
		},
	]

	const { Story } = defineMeta({
		title: 'Components/Layout/Sidebar',
		component: Sidebar,
		tags: ['autodocs'],
		argTypes: {
			nav: {
				control: false,
				description: 'Array of navigation entries (items or collapsible sections).',
			},
			currentPath: {
				control: { type: 'text' },
				description: 'Current URL path for active state detection.',
			},
			collapsed: {
				control: { type: 'boolean' },
				description: 'Whether the sidebar is in collapsed (icon-only) mode.',
			},
			mobileOpen: {
				control: { type: 'boolean' },
				description: 'Whether the mobile overlay sidebar is visible.',
			},
			username: {
				control: { type: 'text' },
				description: 'Display name shown in the user menu trigger.',
			},
			theme: {
				control: { type: 'select' },
				options: ['light', 'dark', 'system'],
				description: 'Active theme, highlighted in the theme switcher.',
			},
			onsignout: {
				control: false,
				description: 'Callback fired when Sign Out is clicked.',
			},
			onthemechange: {
				control: false,
				description: 'Callback fired with the selected theme string.',
			},
		},
		parameters: {
			docs: {
				subtitle:
					'A responsive, collapsible sidebar for dashboard navigation. Accepts a data-driven nav config with icons and sections.',
			},
			layout: 'fullscreen',
		},
	})
</script>

<Story name="Default" asChild>
	<div class="flex h-screen">
		<Sidebar
			nav={sampleNav}
			currentPath="/system/"
			username="Sabina Organizer"
			onsignout={() => alert('Sign out clicked')}
			onthemechange={(t) => alert(`Theme: ${t}`)}
		/>
		<main class="flex-1 bg-surface p-6">
			<h1 class="text-2xl font-bold text-on-surface">Dashboard</h1>
			<p class="mt-2 text-on-surface-subtle">Main content area</p>
		</main>
	</div>
</Story>

<Story name="With Active Item" asChild>
	<div class="flex h-screen">
		<Sidebar
			nav={sampleNav}
			currentPath="/system/data/surveys"
			username="Sabina Organizer"
			onsignout={() => alert('Sign out clicked')}
			onthemechange={(t) => alert(`Theme: ${t}`)}
		/>
		<main class="flex-1 bg-surface p-6">
			<h1 class="text-2xl font-bold text-on-surface">Surveys</h1>
			<p class="mt-2 text-on-surface-subtle">The Data section auto-opens because Surveys is active</p>
		</main>
	</div>
</Story>

<Story name="Collapsed" asChild>
	<div class="flex h-screen">
		<Sidebar
			nav={sampleNav}
			currentPath="/system/"
			username="Sabina Organizer"
			collapsed={true}
			onsignout={() => alert('Sign out clicked')}
			onthemechange={(t) => alert(`Theme: ${t}`)}
		/>
		<main class="flex-1 bg-surface p-6">
			<h1 class="text-2xl font-bold text-on-surface">Dashboard</h1>
			<p class="mt-2 text-on-surface-subtle">Sidebar is in collapsed icon-only mode</p>
		</main>
	</div>
</Story>
