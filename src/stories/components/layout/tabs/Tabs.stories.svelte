<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Tabs from './Tabs.svelte';

	const tabs = [
		{ id: 'overview', label: 'Overview', href: '?tab=overview' },
		{ id: 'members', label: 'Members', href: '?tab=members', count: 1284 },
		{ id: 'activity', label: 'Activity', href: '?tab=activity' },
		{ id: 'audit', label: 'Audit', href: '?tab=audit', count: 3 }
	];

	const { Story } = defineMeta({
		title: 'Components/Layout/Tabs',
		component: Tabs,
		tags: ['autodocs'],
		argTypes: {
			tabs: { control: 'object', description: 'Each tab is a link; the page decides which is active from the URL.' },
			active: { control: 'select', options: tabs.map((t) => t.id) },
			label: { control: 'text' }
		},
		parameters: {
			docs: {
				subtitle:
					'Link tabs for a page with sections, such as a detail page. Each tab is a URL, so tabs can be bookmarked and the back button works. Use TabBar for editor-style tabs instead.'
			}
		}
	});
</script>

<Story name="Default" args={{ tabs, active: 'overview', label: 'Organization sections' }} />

<Story name="With counts" args={{ tabs, active: 'members', label: 'Organization sections' }} />
