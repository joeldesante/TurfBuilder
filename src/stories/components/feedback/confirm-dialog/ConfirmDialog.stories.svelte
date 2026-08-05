<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ConfirmDialog from './ConfirmDialog.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/ConfirmDialog',
		component: ConfirmDialog,
		args: {
			open: true,
			onConfirm: () => {},
			onCancel: () => {}
		}
	});
</script>

<Story
	name="Destructive"
	args={{
		title: 'Delete this location?',
		description:
			'It will be removed from your universe, lists, and turf maps. Past canvassing responses are kept.',
		confirmLabel: 'Delete',
		destructive: true
	}}
/>

<Story
	name="Neutral"
	args={{
		title: 'Approve this location?',
		description: 'It will join your universe and become available to search, buckets, and new turfs.',
		confirmLabel: 'Approve'
	}}
/>

<Story
	name="Loading"
	args={{
		title: 'Delete this location?',
		description: 'This cannot be undone.',
		confirmLabel: 'Delete',
		destructive: true,
		loading: true
	}}
/>

<Story
	name="With Error"
	args={{
		title: 'Delete this location?',
		description: 'This cannot be undone.',
		confirmLabel: 'Delete',
		destructive: true,
		error: 'You do not have permission to delete locations.'
	}}
/>
