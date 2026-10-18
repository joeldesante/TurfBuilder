<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateBucketPage from './CreateBucketPage.svelte';
	import type { FilterSource } from '$lib/client/filter-source';

	// Stands in for the API so the filters that name a bucket or survey have choices.
	const source: FilterSource = {
		listBuckets: async () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Philadelphia voters' }],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => []
	};

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Buckets/New',
		component: CreateBucketPage,
		tags: ['autodocs'],
		args: { source, onCreate: async () => {} }
	});
</script>

<Story name="Default" />
