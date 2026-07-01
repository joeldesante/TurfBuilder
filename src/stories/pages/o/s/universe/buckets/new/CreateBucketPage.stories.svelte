<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateBucketPage from './CreateBucketPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/New',
		component: CreateBucketPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ onCreate: async () => {} }} />
