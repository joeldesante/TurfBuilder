<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SourceBadge from './SourceBadge.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/SourceBadge',
		component: SourceBadge,
		tags: ['autodocs']
	});
</script>

<Story
	name="Link to the source"
	args={{ provider: 'hub', publisher: 'City of Philadelphia', href: 'https://hub.arcgis.com/datasets/example' }}
/>

<Story name="No link" args={{ provider: 'datagov', publisher: 'Department of the Interior' }} />
