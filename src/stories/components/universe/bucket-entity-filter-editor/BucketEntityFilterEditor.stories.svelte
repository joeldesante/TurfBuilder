<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketEntityFilterEditor from './BucketEntityFilterEditor.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketEntityFilterEditor',
		component: BucketEntityFilterEditor
	});
</script>

<Story name="People">
	<BucketEntityFilterEditor entity="People" />
</Story>

<Story name="Locations">
	<BucketEntityFilterEditor entity="Locations" />
</Story>

<Story name="Match All">
	<BucketEntityFilterEditor entity="People" matchType="ALL" />
</Story>

<Story name="Match None">
	<BucketEntityFilterEditor entity="People" matchType="NONE" />
</Story>
