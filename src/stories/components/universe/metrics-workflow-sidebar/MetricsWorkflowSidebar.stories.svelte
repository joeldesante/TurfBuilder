<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MetricsWorkflowSidebar from './MetricsWorkflowSidebar.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/MetricsWorkflowSidebar',
		component: MetricsWorkflowSidebar,
		tags: ['autodocs']
	});

	const sampleBuckets = [
		{ id: 'bucket-1', name: 'Likely Voters', slug: 'likely-voters' },
		{ id: 'bucket-2', name: 'Volunteers', slug: 'volunteers' }
	];
</script>

<Story
	name="Default"
	args={{ orgSlug: 'demo-org', buckets: sampleBuckets, onGenerate: () => {} }}
/>

<Story name="No Buckets" args={{ orgSlug: 'demo-org', buckets: [], onGenerate: () => {} }} />
