<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketScriptsPage from './BucketScriptsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Scripts',
		component: BucketScriptsPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ bucketName: 'Registered Voters' }} />
