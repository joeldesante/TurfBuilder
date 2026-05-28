<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateBucketPage from './CreateBucketPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/CreateBucket',
		component: CreateBucketPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ onCreate: async () => {} }} />
