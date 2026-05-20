<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EntityBrowserRow from './EntityBrowserRow.svelte';
	import ScrollIcon from 'phosphor-svelte/lib/ScrollIcon';
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';

	const { Story } = defineMeta({
		title: 'Components/Data Display/EntityBrowserRow',
		component: EntityBrowserRow,
		tags: ['autodocs']
	});
</script>

<Story name="Script - Today" args={{ name: 'Door Knock Script', date: new Date().toISOString(), href: '#', icon: ScrollIcon }} />
<Story name="Script - This Year" args={{ name: 'Phone Bank Script', date: new Date('2026-01-05').toISOString(), href: '#', icon: ScrollIcon }} />
<Story name="Survey - Older" args={{ name: 'Voter Contact Survey', date: new Date('2024-11-03').toISOString(), href: '#', icon: ClipboardTextIcon }} />
