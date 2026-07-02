<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseMetricsPage from './UniverseMetricsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Metrics',
		component: UniverseMetricsPage,
		tags: ['autodocs']
	});

	const sampleBuckets = [
		{ id: 'bucket-1', name: 'Likely Voters', slug: 'likely-voters' },
		{ id: 'bucket-2', name: 'Volunteers', slug: 'volunteers' }
	];
</script>

<Story name="Default" args={{ orgSlug: 'demo-org', buckets: sampleBuckets }} />
