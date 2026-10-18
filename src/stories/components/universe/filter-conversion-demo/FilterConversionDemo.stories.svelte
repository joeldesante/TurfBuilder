<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FilterConversionDemo from './FilterConversionDemo.svelte';

	const { Story } = defineMeta({
		title: 'Demos/Filter Conversion',
		component: FilterConversionDemo,
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story name="Examples" />
<Story
	name="Not All Of"
	args={{
		input: {
			people: { enabled: false, matchType: 'ONE_OR_MORE', conditions: [] },
			locations: {
				enabled: true,
				matchType: 'NONE',
				conditions: [
					{ filterId: 'city', qualifierId: 'is', value: 'Austin' },
					{ filterId: 'zip_code', qualifierId: 'starts_with', value: '787' }
				]
			}
		}
	}}
/>
<Story
	name="Cannot Convert"
	args={{
		input: {
			people: { enabled: false, matchType: 'ONE_OR_MORE', conditions: [] },
			locations: {
				enabled: true,
				matchType: 'ALL',
				conditions: [{ filterId: 'city', qualifierId: 'contains', value: '50%' }]
			}
		}
	}}
/>
