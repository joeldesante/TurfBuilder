<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SqlPreview from './SqlPreview.svelte';

	const { Story } = defineMeta({
		title: 'Components/DataDisplay/SqlPreview',
		component: SqlPreview
	});
</script>

<Story
	name="With Parameters"
	args={{
		sql: 'SELECT vl.id, vl.source FROM universe.v_locations vl WHERE (lower(vl.city) = lower($1) AND vl.postal_code ILIKE $2)',
		params: ['Austin', '787%']
	}}
/>
<Story name="No Parameters" args={{ sql: 'SELECT vp.id, vp.source FROM universe.v_people vp' }} />
