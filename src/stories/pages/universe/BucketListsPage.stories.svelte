<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketListsPage from './BucketListsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketLists',
		component: BucketListsPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ bucketName: 'Registered Voters' }} />
