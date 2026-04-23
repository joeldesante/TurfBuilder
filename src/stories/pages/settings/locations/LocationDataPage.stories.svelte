<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LocationDataPage from './LocationDataPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Settings/LocationData',
		component: LocationDataPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Org-private location data import page.'
			}
		}
	});
</script>

<Story
	name="Empty Dataset"
	args={{ count: 0, org_slug: 'north-west-philly-alliance' }}
/>

<Story
	name="Existing Data"
	args={{ count: 1482, org_slug: 'north-west-philly-alliance' }}
/>
