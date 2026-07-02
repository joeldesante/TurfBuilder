<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TabBar from './TabBar.svelte';
	import type { Tab } from './TabBar.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Tab Bar',
		component: TabBar,
		tags: ['autodocs'],
		argTypes: {
			tabs: { control: false },
			activeId: { control: 'text' },
			onSelect: { control: false },
			onAdd: { control: false },
			onClose: { control: false },
			onReorder: { control: false }
		},
		parameters: {
			docs: {
				subtitle:
					'A browser-style tab bar. Supports selecting, adding, drag-to-reorder, and closing tabs with a confirmation dialog.'
			}
		}
	});

	const tabs: Tab[] = [
		{ id: '1', label: 'Tab 1' },
		{ id: '2', label: 'Tab 2' },
		{ id: '3', label: 'Tab 3' }
	];
</script>

<Story name="Default" args={{ tabs, activeId: '1', onSelect: () => {}, onAdd: () => {}, onClose: () => {}, onReorder: () => {} }} />

<Story
	name="Single Tab"
	args={{
		tabs: [{ id: '1', label: 'Only Tab' }],
		activeId: '1',
		onSelect: () => {},
		onAdd: () => {},
		onClose: () => {},
		onReorder: () => {}
	}}
/>
