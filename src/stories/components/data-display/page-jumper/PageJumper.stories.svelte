<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PageJumper from './PageJumper.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/PageJumper',
		component: PageJumper,
		tags: ['autodocs']
	});
</script>

<script lang="ts">
	let current = $state(0);
	const startOf = (page: number) => page * 100;
</script>

<Story name="Many pages" asChild>
	<PageJumper pageCount={40} {current} onSelect={(page) => (current = page)} {startOf} />
</Story>

<Story name="Five pages or fewer" asChild>
	<PageJumper pageCount={4} {current} onSelect={(page) => (current = page)} {startOf} />
</Story>
