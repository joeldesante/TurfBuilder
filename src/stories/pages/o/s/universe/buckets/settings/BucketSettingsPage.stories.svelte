<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketSettingsPage from './BucketSettingsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Settings',
		component: BucketSettingsPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	args={{
		bucketName: 'Austin voters',
		onRename: async () => {},
		onDelete: async () => {}
	}}
/>
