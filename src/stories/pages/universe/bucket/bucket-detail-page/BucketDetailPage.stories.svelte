<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketDetailPage from './BucketDetailPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketDetail',
		component: BucketDetailPage,
		tags: ['autodocs']
	});
</script>

<Story name="With Description" args={{ name: 'Registered Voters', description: 'All registered voters in the target universe.' }} />
<Story name="No Description" args={{ name: 'High Priority Doors' }} />
