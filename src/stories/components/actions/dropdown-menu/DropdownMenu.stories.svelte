<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DropdownMenu from './DropdownMenu.svelte';
	import Button from '../button/Button.svelte';
	import DotsThreeVerticalIcon from 'phosphor-svelte/lib/DotsThreeVertical';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import CopyIcon from 'phosphor-svelte/lib/Copy';
	import ArchiveIcon from 'phosphor-svelte/lib/Archive';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import LinkIcon from 'phosphor-svelte/lib/Link';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';

	const { Story } = defineMeta({
		title: 'Components/Actions/Dropdown Menu',
		component: DropdownMenu,
		tags: ['autodocs'],
		argTypes: {
			align: {
				control: { type: 'radio' },
				options: ['start', 'center', 'end'],
				description: 'Horizontal alignment of the menu content relative to the trigger.'
			},
			side: {
				control: { type: 'select' },
				options: ['top', 'bottom', 'left', 'right'],
				description: 'Side the menu content appears on relative to the trigger.'
			},
			sideOffset: {
				control: { type: 'number' },
				description: 'Gap in pixels between the trigger and the menu content.'
			},
			items: {
				control: false,
				description: 'Array of menu entries — items or separators.'
			},
			children: {
				control: false,
				description: 'The trigger element rendered inside the dropdown trigger.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A data-driven dropdown menu that opens when a trigger is clicked. Supports icons, links, destructive items, and separators.'
			}
		}
	});
</script>

<Story name="Default" asChild>
	<DropdownMenu items={[{ label: 'Edit' }, { label: 'Duplicate' }, { label: 'Archive' }]}>
		<Button variant="ghost" iconOnly aria-label="More options">
			<DotsThreeVerticalIcon />
		</Button>
	</DropdownMenu>
</Story>

<Story name="With Icons" asChild>
	<DropdownMenu
		items={[
			{ label: 'Edit', icon: PencilSimpleIcon },
			{ label: 'Duplicate', icon: CopyIcon },
			{ label: 'Archive', icon: ArchiveIcon }
		]}
	>
		<Button variant="ghost" iconOnly aria-label="More options">
			<DotsThreeVerticalIcon />
		</Button>
	</DropdownMenu>
</Story>

<Story name="With Destructive Item" asChild>
	<DropdownMenu
		items={[
			{ label: 'Edit', icon: PencilSimpleIcon },
			{ label: 'Duplicate', icon: CopyIcon },
			{ label: 'Archive', icon: ArchiveIcon },
			{ separator: true },
			{ label: 'Delete', icon: TrashIcon, variant: 'destructive', onclick: () => {} }
		]}
	>
		<Button variant="ghost" iconOnly aria-label="More options">
			<DotsThreeVerticalIcon />
		</Button>
	</DropdownMenu>
</Story>

<Story name="With Disabled Items" asChild>
	<DropdownMenu
		items={[
			{ label: 'Edit', icon: PencilSimpleIcon },
			{ label: 'Duplicate', icon: CopyIcon, disabled: true },
			{ label: 'Archive', icon: ArchiveIcon, disabled: true },
			{ separator: true },
			{ label: 'Delete', icon: TrashIcon, variant: 'destructive' }
		]}
	>
		<Button variant="ghost" iconOnly aria-label="More options">
			<DotsThreeVerticalIcon />
		</Button>
	</DropdownMenu>
</Story>

<Story name="With Link Items" asChild>
	<DropdownMenu
		items={[
			{ label: 'Copy link', icon: LinkIcon, onclick: () => {} },
			{ separator: true },
			{ label: 'Open in new tab', icon: ArrowSquareOutIcon, href: 'https://turfbuilder.org' }
		]}
	>
		<Button variant="outline">Share</Button>
	</DropdownMenu>
</Story>

<Story name="Align Start" asChild>
	<DropdownMenu
		align="start"
		items={[
			{ label: 'Edit', icon: PencilSimpleIcon },
			{ label: 'Duplicate', icon: CopyIcon },
			{ separator: true },
			{ label: 'Delete', icon: TrashIcon, variant: 'destructive' }
		]}
	>
		<Button variant="outline">Actions</Button>
	</DropdownMenu>
</Story>
