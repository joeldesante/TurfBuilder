<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketScriptsPage from './BucketScriptsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketScripts',
		component: BucketScriptsPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ bucketName: 'Registered Voters' }} />
