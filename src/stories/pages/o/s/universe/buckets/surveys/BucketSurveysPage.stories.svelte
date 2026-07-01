<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketSurveysPage from './BucketSurveysPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/Surveys',
		component: BucketSurveysPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ bucketName: 'Registered Voters', bucketSlug: 'registered-voters', orgSlug: 'test-org', surveys: [] }} />
