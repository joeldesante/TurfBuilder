<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Pagination from './Pagination.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Pagination',
		component: Pagination,
		args: { page: 1, totalCount: 250, pageSize: 100, noun: 'locations' }
	});
</script>

<Story name="First Page" />
<Story name="Middle Of Many" args={{ page: 8, totalCount: 2000 }} />
<Story name="Single Page" args={{ totalCount: 40 }} />
<Story name="Empty" args={{ totalCount: 0 }} />
<Story name="With Extra Text">
	{#snippet template(args)}
		<Pagination {...args}>Use Quick Search to filter.</Pagination>
	{/snippet}
</Story>
